"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { cancelSubscriptionAtPeriodEnd } from "@/lib/subscriptions/lifecycle";
import {
  cancelSubscriptionSchema,
  subscribeSchema,
} from "@/lib/subscriptions/schemas";
import { startSubscription } from "@/lib/subscriptions/service";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function subscribeToPlan(
  input: unknown,
): Promise<ActionResult<{ checkoutUrl?: string; subscriptionId?: string }>> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (!auth.email) {
    return { success: false, error: "Account email is required for checkout." };
  }

  try {
    const result = await startSubscription(supabase, {
      fanId: auth.userId,
      fanEmail: auth.email,
      planId: parsed.data.planId,
      offerId: parsed.data.offerId,
    });

    if (result.type === "checkout") {
      return {
        success: true,
        data: { checkoutUrl: result.authorizationUrl },
      };
    }

    revalidatePath("/subscriptions");
    return {
      success: true,
      data: { subscriptionId: result.subscriptionId },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start subscription.";
    return { success: false, error: message };
  }
}

export async function cancelFanSubscription(
  input: unknown,
): Promise<ActionResult> {
  const parsed = cancelSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  try {
    await cancelSubscriptionAtPeriodEnd(
      supabase,
      parsed.data.subscriptionId,
      auth.userId,
    );
    revalidatePath("/subscriptions");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not cancel subscription.";
    return { success: false, error: message };
  }
}
