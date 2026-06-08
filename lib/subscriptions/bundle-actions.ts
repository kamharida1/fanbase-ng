"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { createBundleSchema } from "@/lib/subscriptions/schemas";

export type BundleResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function createPlanBundle(
  input: unknown,
): Promise<BundleResult<{ bundleId: string }>> {
  const parsed = createBundleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id, creator_id, billing_interval")
    .eq("id", parsed.data.planId)
    .eq("creator_id", auth.userId)
    .maybeSingle();

  if (!plan) return { success: false, error: "Plan not found." };
  if (plan.billing_interval !== "monthly") {
    return {
      success: false,
      error: "Bundles are only available for monthly plans.",
    };
  }

  const { data, error } = await supabase
    .from("subscription_plan_bundles")
    .insert({
      creator_id: auth.userId,
      plan_id: parsed.data.planId,
      months: parsed.data.months,
      discount_pct: parsed.data.discountPct,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "This plan already has a bundle for that duration.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/creator/tiers");
  revalidatePath(`/creators/${auth.profile.username}`);
  return { success: true, data: { bundleId: data.id } };
}

export async function deactivatePlanBundle(
  bundleId: string,
): Promise<BundleResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase
    .from("subscription_plan_bundles")
    .update({ is_active: false })
    .eq("id", bundleId)
    .eq("creator_id", auth.userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/creator/tiers");
  revalidatePath(`/creators/${auth.profile.username}`);
  return { success: true };
}
