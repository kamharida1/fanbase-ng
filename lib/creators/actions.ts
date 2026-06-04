"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  ngnToKobo,
  subscriptionPlanSchema,
  updateCreatorProfileSchema,
  updateProfileBasicsSchema,
} from "@/lib/creators/schemas";
import { createPaystackPlan } from "@/lib/paystack/plans";
import type { PlanBillingInterval } from "@/types/subscription";
import { uploadProfileImage } from "@/lib/creators/storage";
import { normalizeSocialLinks } from "@/lib/creators/format";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function revalidateCreatorPaths(username: string) {
  revalidatePath("/creators");
  revalidatePath(`/creators/${username}`);
  revalidatePath("/discover");
  revalidatePath("/creator/profile");
  revalidatePath("/creator/tiers");
  revalidatePath("/creator/dashboard");
  // Bust the unstable_cache entry for this creator's public profile data.
  revalidateTag(`creator:${username}`);
}

export async function applyAsCreator(): Promise<ActionResult<{ username: string }>> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role === "creator") {
    return { success: true, data: { username: auth.profile.username } };
  }

  const { error: insertError } = await supabase.from("creator_profiles").insert({
    user_id: auth.userId,
    bio: null,
    social_links: {},
  });

  if (insertError && insertError.code !== "23505") {
    return { success: false, error: insertError.message };
  }

  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: "creator" })
    .eq("id", auth.userId);

  if (roleError) {
    return { success: false, error: roleError.message };
  }

  revalidateCreatorPaths(auth.profile.username);
  return { success: true, data: { username: auth.profile.username } };
}

export async function updateProfileBasics(
  input: unknown,
): Promise<ActionResult> {
  const parsed = updateProfileBasicsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      username: parsed.data.username,
    })
    .eq("id", auth.userId);

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Username is already taken." };
    }
    return { success: false, error: error.message };
  }

  revalidateCreatorPaths(parsed.data.username);
  revalidatePath("/settings");
  return { success: true };
}

export async function updateCreatorProfile(
  input: unknown,
): Promise<ActionResult> {
  const parsed = updateCreatorProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  const social = normalizeSocialLinks(parsed.data.social_links);

  const { error } = await supabase
    .from("creator_profiles")
    .update({
      bio: parsed.data.bio || null,
      is_accepting_subscribers: parsed.data.is_accepting_subscribers ?? true,
      social_links: social,
    })
    .eq("user_id", auth.userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateCreatorPaths(auth.profile.username);
  return { success: true };
}

export async function updateProfileImageUrl(
  type: "avatar" | "banner",
  url: string,
): Promise<ActionResult> {
  const trimmed = url.trim();
  if (trimmed && !/^https?:\/\//.test(trimmed)) {
    return { success: false, error: "Image URL must start with http:// or https://" };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (type === "avatar") {
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: trimmed || null })
      .eq("id", auth.userId);
    if (error) return { success: false, error: error.message };
  } else {
    if (auth.profile.role !== "creator") {
      return { success: false, error: "Creator account required." };
    }
    const { error } = await supabase
      .from("creator_profiles")
      .update({ banner_url: trimmed || null })
      .eq("user_id", auth.userId);
    if (error) return { success: false, error: error.message };
  }

  revalidateCreatorPaths(auth.profile.username);
  return { success: true };
}

export async function uploadProfileImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const type = formData.get("type");
  const file = formData.get("file");

  if (type !== "avatar" && type !== "banner") {
    return { success: false, error: "Invalid upload type." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file selected." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const result = await uploadProfileImage(
    supabase,
    auth.userId,
    type,
    file,
  );

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const urlResult = await updateProfileImageUrl(type, result.url);
  if (!urlResult.success) {
    return { success: false, error: urlResult.error };
  }

  return { success: true, data: { url: result.url } };
}

export async function upsertSubscriptionPlan(
  input: unknown,
  planId?: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = subscriptionPlanSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid plan",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  const billingInterval = parsed.data.billing_interval as PlanBillingInterval;
  const priceKobo = ngnToKobo(parsed.data.price_ngn);

  const payload = {
    creator_id: auth.userId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    price_kobo: priceKobo,
    billing_interval: billingInterval,
    trial_days: parsed.data.trial_days,
    sort_order: parsed.data.sort_order,
    is_active: parsed.data.is_active,
  };

  if (planId) {
    const { data: existing } = await supabase
      .from("subscription_plans")
      .select("paystack_plan_code, billing_interval")
      .eq("id", planId)
      .eq("creator_id", auth.userId)
      .maybeSingle();

    const { error } = await supabase
      .from("subscription_plans")
      .update(payload)
      .eq("id", planId)
      .eq("creator_id", auth.userId);

    if (error) return { success: false, error: error.message };

    if (
      billingInterval !== "free" &&
      !existing?.paystack_plan_code &&
      process.env.PAYSTACK_SECRET_KEY
    ) {
      try {
        const code = await createPaystackPlan({
          name: parsed.data.name,
          priceKobo,
          billingInterval,
        });
        await supabase
          .from("subscription_plans")
          .update({ paystack_plan_code: code })
          .eq("id", planId);
      } catch {
        // Plan saved locally; Paystack sync can be retried on next edit.
      }
    }

    revalidateCreatorPaths(auth.profile.username);
    return { success: true, data: { id: planId } };
  }

  const { data, error } = await supabase
    .from("subscription_plans")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  if (billingInterval !== "free" && process.env.PAYSTACK_SECRET_KEY) {
    try {
      const code = await createPaystackPlan({
        name: parsed.data.name,
        priceKobo,
        billingInterval,
      });
      await supabase
        .from("subscription_plans")
        .update({ paystack_plan_code: code })
        .eq("id", data.id);
    } catch {
      // Non-fatal: creator can still offer plan; checkout uses one-time initialize.
    }
  }

  revalidateCreatorPaths(auth.profile.username);
  return { success: true, data: { id: data.id } };
}

export async function deactivateSubscriptionPlan(
  planId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase
    .from("subscription_plans")
    .update({ is_active: false })
    .eq("id", planId)
    .eq("creator_id", auth.userId);

  if (error) return { success: false, error: error.message };

  revalidateCreatorPaths(auth.profile.username);
  return { success: true };
}
