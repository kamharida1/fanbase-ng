"use server";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { submitReportSchema, type SubmitReportInput } from "@/lib/reports/schemas";

export type ReportActionResult =
  | { success: true }
  | { success: false; error: string };

export async function submitReport(input: SubmitReportInput): Promise<ReportActionResult> {
  const parsed = submitReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid report." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  const { reason, details, postId, reportedUserId } = parsed.data;

  if (reportedUserId && reportedUserId === auth.userId) {
    return { success: false, error: "You can't report yourself." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("reports").insert({
    reporter_id: auth.userId,
    reported_user_id: reportedUserId ?? null,
    post_id: postId ?? null,
    reason,
    details: details || null,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
