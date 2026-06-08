"use server";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type BroadcastResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type BroadcastRecord = {
  id: string;
  body: string;
  is_ppv: boolean;
  ppv_price_kobo: number | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: "sending" | "completed" | "partial" | "failed";
  audience_label: string | null;
  created_at: string;
};

export type BroadcastPlanOption = {
  id: string;
  name: string;
  price_kobo: number;
  billing_interval: string;
};

export type BroadcastSegment = "active" | "new" | "longtime" | "lapsing";

export type BroadcastAudience = {
  planId?: string | null;
  segment?: BroadcastSegment;
};

const SEGMENT_LABELS: Record<BroadcastSegment, string> = {
  active: "Active subscribers",
  new: "New subscribers (joined in the last 30 days)",
  longtime: "Long-time subscribers (90+ days)",
  lapsing: "Lapsing soon (set to cancel at period end)",
};

const NEW_SUBSCRIBER_DAYS = 30;
const LONGTIME_SUBSCRIBER_DAYS = 90;

// Hard cap per send to avoid request timeouts.
// Larger audiences need a background job queue (future work).
const BROADCAST_CAP = 500;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAudienceFilters(query: any, audience: BroadcastAudience | undefined) {
  if (audience?.planId) {
    query = query.eq("plan_id", audience.planId);
  }

  const segment = audience?.segment ?? "active";
  const now = Date.now();
  const MS_DAY = 86_400_000;

  switch (segment) {
    case "lapsing":
      query = query
        .in("status", ["active", "trialing", "past_due"])
        .eq("cancel_at_period_end", true);
      break;
    case "new":
      query = query
        .in("status", ["active", "trialing"])
        .gte("created_at", new Date(now - NEW_SUBSCRIBER_DAYS * MS_DAY).toISOString());
      break;
    case "longtime":
      query = query
        .in("status", ["active", "trialing"])
        .lt("created_at", new Date(now - LONGTIME_SUBSCRIBER_DAYS * MS_DAY).toISOString());
      break;
    default:
      query = query.in("status", ["active", "trialing"]);
  }

  return query;
}

function audienceLabel(audience: BroadcastAudience | undefined, planName: string | null): string {
  const parts: string[] = [];
  if (planName) parts.push(`${planName} tier`);
  parts.push(SEGMENT_LABELS[audience?.segment ?? "active"]);
  return parts.join(" · ");
}

export async function listCreatorBroadcastPlans(
  creatorId: string,
): Promise<BroadcastPlanOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscription_plans")
    .select("id, name, price_kobo, billing_interval")
    .eq("creator_id", creatorId)
    .eq("is_active", true)
    .neq("billing_interval", "free")
    .order("sort_order", { ascending: true });

  return (data ?? []) as BroadcastPlanOption[];
}

export async function getAudienceCount(
  creatorId: string,
  audience?: BroadcastAudience,
): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId);

  query = applyAudienceFilters(query, audience);

  const { count } = await query;
  return count ?? 0;
}

export async function listBroadcasts(limit = 20): Promise<BroadcastRecord[]> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data } = await supabase
    .from("broadcasts")
    .select(
      "id, body, is_ppv, ppv_price_kobo, total_recipients, sent_count, failed_count, status, audience_label, created_at",
    )
    .eq("creator_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as BroadcastRecord[];
}

export async function sendBroadcast(input: {
  body: string;
  isPpv: boolean;
  ppvPriceKobo: number | null;
  audience?: BroadcastAudience;
}): Promise<BroadcastResult<{ sentCount: number; totalCount: number }>> {
  const body = input.body.trim();
  if (!body) return { success: false, error: "Message body is required." };
  if (body.length > 2000) return { success: false, error: "Message is too long (max 2000 chars)." };
  if (input.isPpv && (!input.ppvPriceKobo || input.ppvPriceKobo < 10_000)) {
    return { success: false, error: "PPV price must be at least ₦100." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  const admin = createAdminClient();

  let planName: string | null = null;
  if (input.audience?.planId) {
    const { data: plan } = await admin
      .from("subscription_plans")
      .select("name")
      .eq("id", input.audience.planId)
      .eq("creator_id", auth.userId)
      .maybeSingle();
    if (!plan) return { success: false, error: "Selected plan was not found." };
    planName = plan.name;
  }

  // Fetch matching subscribers (capped)
  let subsQuery = admin
    .from("subscriptions")
    .select("fan_id")
    .eq("creator_id", auth.userId);
  subsQuery = applyAudienceFilters(subsQuery, input.audience);
  const { data: subs, error: subError } = await subsQuery.limit(BROADCAST_CAP);

  if (subError) return { success: false, error: subError.message };
  if (!subs?.length) {
    return { success: false, error: "No subscribers match this audience." };
  }

  const totalCount = subs.length;

  // Create broadcast record before sending
  const { data: broadcastRow, error: insertError } = await admin
    .from("broadcasts")
    .insert({
      creator_id: auth.userId,
      body,
      is_ppv: input.isPpv,
      ppv_price_kobo: input.isPpv ? input.ppvPriceKobo : null,
      total_recipients: totalCount,
      sent_count: 0,
      failed_count: 0,
      status: "sending",
      audience_label: audienceLabel(input.audience, planName),
    })
    .select("id")
    .single();

  if (insertError || !broadcastRow) {
    return { success: false, error: insertError?.message ?? "Could not create broadcast record." };
  }

  const broadcastId = broadcastRow.id as string;
  const sentAt = new Date().toISOString();
  let sentCount = 0;

  // Process in batches of 50 to stay within Supabase's per-query limits
  const BATCH = 50;
  for (let i = 0; i < subs.length; i += BATCH) {
    const batch = subs.slice(i, i + BATCH);

    await Promise.allSettled(
      batch.map(async ({ fan_id }) => {
        try {
          // Find or create conversation (creator-initiated → accepted status)
          const { data: convId, error: convError } = await admin.rpc(
            "get_or_create_conversation",
            {
              p_fan_id: fan_id,
              p_creator_id: auth.userId,
              p_initiator_id: auth.userId,
            },
          );

          if (convError || !convId) return;

          const { error: msgError } = await admin.from("messages").insert({
            conversation_id: convId as string,
            sender_id: auth.userId,
            body,
            is_ppv: input.isPpv,
            ppv_price_kobo: input.isPpv ? input.ppvPriceKobo : null,
            created_at: sentAt,
          });

          if (!msgError) sentCount++;
        } catch {
          // Individual failures are silently skipped; sentCount reflects reality
        }
      }),
    );
  }

  const failedCount = totalCount - sentCount;
  const status =
    sentCount === 0
      ? "failed"
      : sentCount < totalCount
        ? "partial"
        : "completed";

  // Update broadcast record with final delivery counts
  await admin
    .from("broadcasts")
    .update({ sent_count: sentCount, failed_count: failedCount, status })
    .eq("id", broadcastId);

  if (sentCount === 0) {
    return { success: false, error: "Could not send to any subscribers. Please try again." };
  }

  return { success: true, data: { sentCount, totalCount } };
}
