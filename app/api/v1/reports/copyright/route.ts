import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { notifyCopyrightClaim } from "@/lib/notifications/emit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const COUNTER_NOTICE_DAYS = 14;

const submitClaimSchema = z.object({
  post_id: z.string().uuid("Invalid post id"),
  claimant_name: z.string().min(2).max(200),
  claimant_email: z.string().email(),
  description: z
    .string()
    .min(50, "Please describe the original work (min 50 characters)")
    .max(5000),
  original_url: z.string().url().optional().or(z.literal("")),
});

/**
 * POST /api/v1/reports/copyright
 * File a DMCA / copyright infringement claim against a post.
 * Auth is optional — external rights-holders can file without an account.
 */
export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = submitClaimSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  const { post_id, claimant_name, claimant_email, description, original_url } =
    parsed.data;

  const admin = createAdminClient();

  // Verify the post exists and is publicly accessible
  const { data: post } = await admin
    .from("posts")
    .select("id, title, creator_id, status")
    .eq("id", post_id)
    .maybeSingle();

  if (!post || post.status === "removed") {
    return NextResponse.json(
      { error: "Post not found or already removed." },
      { status: 404 },
    );
  }

  // Identify optional logged-in claimant
  let claimantId: string | null = null;
  try {
    const supabase = await createClient();
    const ctx = await getAuthContext(supabase);
    if (ctx) claimantId = ctx.userId;
  } catch {
    // unauthenticated filer — allowed
  }

  const deadline = new Date(
    Date.now() + COUNTER_NOTICE_DAYS * 24 * 60 * 60 * 1000,
  );

  const { data: claim, error: insertErr } = await admin
    .from("copyright_claims")
    .insert({
      post_id,
      claimant_id: claimantId,
      claimant_name,
      claimant_email,
      description,
      original_url: original_url || null,
      status: "pending_counter_notice",
      counter_notice_deadline: deadline.toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !claim) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Could not record claim." },
      { status: 500 },
    );
  }

  // Queue for admin review at priority 400 (below CSAM hash=1000, above velocity=300)
  await admin
    .from("moderation_queue")
    .upsert(
      {
        entity_type: "post",
        entity_id: post_id,
        priority_score: 400,
        flags: {
          copyright_claim: true,
          claim_id: claim.id,
          claimant_email,
          deadline: deadline.toISOString(),
        },
      },
      { onConflict: "entity_type,entity_id", ignoreDuplicates: false },
    );

  await writeAuditLog(admin, {
    actorId: claimantId,
    actorType: claimantId ? "user" : "system",
    action: "copyright.claim_submitted",
    entityType: "copyright_claims",
    entityId: claim.id,
    afterState: { post_id, claimant_email, deadline: deadline.toISOString() },
  });

  // Notify the creator (best-effort)
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, username")
      .eq("id", post.creator_id)
      .single();

    await notifyCopyrightClaim(admin, {
      creatorId: post.creator_id,
      creatorName: profile?.display_name ?? profile?.username ?? "Creator",
      postId: post_id,
      postTitle: post.title ?? "Untitled post",
      claimId: claim.id,
      deadlineDate: deadline.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    });
  } catch {
    // notification failure must not fail the claim submission
  }

  return NextResponse.json(
    {
      id: claim.id,
      status: "pending_counter_notice",
      counter_notice_deadline: deadline.toISOString(),
      message:
        "Your claim has been received. The creator has been notified and has 14 days to file a counter-notice before the post is removed.",
    },
    { status: 201 },
  );
}
