import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { requireApiAuth } from "@/lib/auth/api";
import { notifyCounterNoticeToClaimant } from "@/lib/notifications/emit";
import { createAdminClient } from "@/lib/supabase/admin";

const counterSchema = z.object({
  statement: z
    .string()
    .min(50, "Please provide a statement of at least 50 characters")
    .max(5000),
});

/**
 * POST /api/v1/reports/copyright/:id/counter
 * Creator submits a counter-notice to dispute a copyright claim.
 * Must be the post's owner and must be within the counter_notice_deadline.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const { id: claimId } = await params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = counterSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: claim } = await admin
    .from("copyright_claims")
    .select(
      "id, post_id, status, counter_notice_deadline, claimant_email, claimant_name",
    )
    .eq("id", claimId)
    .maybeSingle();

  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }

  if (claim.status !== "pending_counter_notice") {
    return NextResponse.json(
      {
        error:
          claim.status === "counter_noticed"
            ? "A counter-notice has already been submitted for this claim."
            : "This claim is no longer open for counter-notices.",
      },
      { status: 409 },
    );
  }

  if (new Date(claim.counter_notice_deadline) < new Date()) {
    return NextResponse.json(
      { error: "The counter-notice window for this claim has expired." },
      { status: 410 },
    );
  }

  // Verify the requesting user owns the post
  const { data: post } = await admin
    .from("posts")
    .select("creator_id, title")
    .eq("id", claim.post_id)
    .maybeSingle();

  if (!post || post.creator_id !== authResult.ctx.userId) {
    return NextResponse.json(
      { error: "You are not the creator of this post." },
      { status: 403 },
    );
  }

  const now = new Date().toISOString();

  await admin
    .from("copyright_claims")
    .update({
      status: "counter_noticed",
      counter_notice_at: now,
      counter_notice_body: parsed.data.statement,
    })
    .eq("id", claimId);

  // Escalate priority in moderation queue so admin reviews promptly
  await admin
    .from("moderation_queue")
    .update({
      priority_score: 450,
      flags: {
        copyright_claim: true,
        claim_id: claimId,
        counter_noticed: true,
        counter_notice_at: now,
      },
    })
    .eq("entity_type", "post")
    .eq("entity_id", claim.post_id);

  await writeAuditLog(admin, {
    actorId: authResult.ctx.userId,
    actorType: "user",
    action: "copyright.counter_notice_submitted",
    entityType: "copyright_claims",
    entityId: claimId,
    afterState: { post_id: claim.post_id, counter_notice_at: now },
  });

  // Notify the claimant via email (they may not be a platform user)
  try {
    await notifyCounterNoticeToClaimant(admin, {
      claimantEmail: claim.claimant_email,
      postTitle: post.title ?? "Untitled post",
      counterBody: parsed.data.statement,
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({
    ok: true,
    message:
      "Your counter-notice has been recorded. Our team will review both submissions and reach a decision within 10 business days. The claimant has been notified.",
  });
}
