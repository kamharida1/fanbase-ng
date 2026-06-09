import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { requireApiAuth } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/supabase/admin";

const reportSchema = z.object({
  reported_user_id: z.string().uuid("Invalid user id"),
  impersonating: z
    .string()
    .min(2)
    .max(200, "Please name the creator being impersonated"),
  details: z.string().max(2000).optional(),
});

/**
 * POST /api/v1/reports/impersonation
 * Report an account for impersonating a known creator or public figure.
 * Uses the existing reports table with reason = 'impersonation'.
 */
export async function POST(request: Request): Promise<Response> {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  const { reported_user_id, impersonating, details } = parsed.data;
  const { userId } = authResult.ctx;

  if (reported_user_id === userId) {
    return NextResponse.json(
      { error: "You cannot report yourself." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Verify the reported user exists
  const { data: target } = await admin
    .from("profiles")
    .select("id, status")
    .eq("id", reported_user_id)
    .maybeSingle();

  if (!target || target.status === "deleted") {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Prevent duplicate reports from the same reporter within 24 hours
  const { count } = await admin
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", userId)
    .eq("reported_user_id", reported_user_id)
    .eq("reason", "impersonation")
    .gte(
      "created_at",
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    );

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "You have already reported this user recently." },
      { status: 409 },
    );
  }

  const { data: report, error: insertErr } = await admin
    .from("reports")
    .insert({
      reporter_id: userId,
      reported_user_id,
      reason: "impersonation",
      details: details
        ? `Impersonating: ${impersonating}\n\n${details}`
        : `Impersonating: ${impersonating}`,
      status: "open",
    })
    .select("id")
    .single();

  if (insertErr || !report) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Could not file report." },
      { status: 500 },
    );
  }

  // Queue for elevated review — impersonation reports are high priority
  await admin
    .from("moderation_queue")
    .upsert(
      {
        entity_type: "user",
        entity_id: reported_user_id,
        priority_score: 350,
        flags: {
          impersonation_report: true,
          report_id: report.id,
          impersonating,
        },
      },
      { onConflict: "entity_type,entity_id", ignoreDuplicates: false },
    );

  await writeAuditLog(admin, {
    actorId: userId,
    actorType: "user",
    action: "account.impersonation_reported",
    entityType: "reports",
    entityId: report.id,
    afterState: { reported_user_id, impersonating },
  });

  return NextResponse.json(
    {
      id: report.id,
      message:
        "Your report has been received. Our team will review it and take action if this account violates our policies.",
    },
    { status: 201 },
  );
}
