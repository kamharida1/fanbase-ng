"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type OfferResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function createOffer(input: {
  planId: string;
  label: string;
  discountPct: number;
  durationHours: number;
  maxRedemptions?: number;
}): Promise<OfferResult<{ offerId: string }>> {
  if (input.discountPct < 1 || input.discountPct > 99) {
    return { success: false, error: "Discount must be between 1% and 99%." };
  }
  if (input.durationHours < 1) {
    return { success: false, error: "Duration must be at least 1 hour." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  // Verify plan belongs to creator
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("id, creator_id")
    .eq("id", input.planId)
    .eq("creator_id", auth.userId)
    .maybeSingle();

  if (!plan) return { success: false, error: "Plan not found." };

  const endsAt = new Date(
    Date.now() + input.durationHours * 3_600_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("subscription_offers")
    .insert({
      creator_id: auth.userId,
      plan_id: input.planId,
      label: input.label.trim(),
      discount_pct: input.discountPct,
      ends_at: endsAt,
      max_redemptions: input.maxRedemptions ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/creator/tiers");
  revalidatePath(`/creators/${auth.profile.username}`);
  return { success: true, data: { offerId: data.id } };
}

export async function deactivateOffer(offerId: string): Promise<OfferResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase
    .from("subscription_offers")
    .update({ is_active: false })
    .eq("id", offerId)
    .eq("creator_id", auth.userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/creator/tiers");
  revalidatePath(`/creators/${auth.profile.username}`);
  return { success: true };
}

export async function recordOfferRedemption(
  admin: ReturnType<typeof createAdminClient>,
  offerId: string,
): Promise<void> {
  // Increment redemption count; fall back to a simple update if RPC unavailable
  const { error: rpcError } = await admin.rpc("increment", {
    table: "subscription_offers",
    column: "redemption_count",
    row_id: offerId,
  });
  if (rpcError) {
    await admin
      .from("subscription_offers")
      .update({ redemption_count: 999 })
      .eq("id", offerId);
  }

  // Check if max redemptions reached → deactivate
  const { data: offer } = await admin
    .from("subscription_offers")
    .select("max_redemptions, redemption_count")
    .eq("id", offerId)
    .single();

  if (
    offer?.max_redemptions != null &&
    offer.redemption_count >= offer.max_redemptions
  ) {
    await admin
      .from("subscription_offers")
      .update({ is_active: false })
      .eq("id", offerId);
  }
}
