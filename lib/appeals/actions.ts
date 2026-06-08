"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { submitAppealSchema } from "@/lib/appeals/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AppealActionResult =
  | { success: true }
  | { success: false; error: string };

export async function submitAppeal(input: unknown): Promise<AppealActionResult> {
  const parsed = submitAppealSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const ctx = await getAuthContext(supabase);

  if (!ctx) {
    return { success: false, error: "You need to be signed in to appeal." };
  }

  if (ctx.profile.status !== "suspended" && ctx.profile.status !== "banned") {
    return {
      success: false,
      error: "Your account is in good standing — there's nothing to appeal.",
    };
  }

  const { data: existing } = await supabase
    .from("account_appeals")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: "You already have an appeal under review.",
    };
  }

  const { data: appeal, error } = await supabase
    .from("account_appeals")
    .insert({
      user_id: ctx.userId,
      account_status_at_submission: ctx.profile.status,
      message: parsed.data.message,
    })
    .select("id")
    .single();

  if (error || !appeal) {
    return {
      success: false,
      error: "Couldn't submit your appeal. Please try again.",
    };
  }

  const admin = createAdminClient();
  await writeAuditLog(admin, {
    actorId: ctx.userId,
    actorType: "user",
    action: "appeal.submitted",
    entityType: "account_appeals",
    entityId: appeal.id,
    afterState: { status: "pending", account_status: ctx.profile.status },
  });

  revalidatePath("/appeal");
  return { success: true };
}
