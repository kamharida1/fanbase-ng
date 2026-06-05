"use server";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type BroadcastResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// Hard cap per send to avoid request timeouts.
// Larger audiences need a background job queue (future work).
const BROADCAST_CAP = 500;

export async function getActiveSubscriberCount(
  creatorId: string,
): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .in("status", ["active", "trialing"]);
  return count ?? 0;
}

export async function sendBroadcast(input: {
  body: string;
  isPpv: boolean;
  ppvPriceKobo: number | null;
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

  // Fetch active subscribers (capped)
  const { data: subs, error: subError } = await admin
    .from("subscriptions")
    .select("fan_id")
    .eq("creator_id", auth.userId)
    .in("status", ["active", "trialing"])
    .limit(BROADCAST_CAP);

  if (subError) return { success: false, error: subError.message };
  if (!subs?.length) return { success: false, error: "You have no active subscribers yet." };

  const totalCount = subs.length;
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

  if (sentCount === 0) {
    return { success: false, error: "Could not send to any subscribers. Please try again." };
  }

  return { success: true, data: { sentCount, totalCount } };
}
