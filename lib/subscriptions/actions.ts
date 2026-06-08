"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/get-auth-context";
import {
  cancelSubscriptionAtPeriodEnd,
  pauseSubscription,
  resumeSubscription,
} from "@/lib/subscriptions/lifecycle";
import { startGiftSubscription } from "@/lib/subscriptions/gifting";
import {
  cancelSubscriptionSchema,
  pauseSubscriptionSchema,
  sendGiftSchema,
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
      bundleId: parsed.data.bundleId,
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

export async function pauseFanSubscription(
  input: unknown,
): Promise<ActionResult> {
  const parsed = pauseSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  try {
    await pauseSubscription(supabase, parsed.data.subscriptionId, auth.userId);
    revalidatePath("/subscriptions");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not pause subscription.";
    return { success: false, error: message };
  }
}

export async function resumeFanSubscription(
  input: unknown,
): Promise<ActionResult> {
  const parsed = pauseSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  try {
    await resumeSubscription(supabase, parsed.data.subscriptionId, auth.userId);
    revalidatePath("/subscriptions");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not resume subscription.";
    return { success: false, error: message };
  }
}

export async function sendGiftSubscription(
  input: unknown,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const parsed = sendGiftSchema.safeParse(input);
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
    const result = await startGiftSubscription(supabase, {
      gifterId: auth.userId,
      gifterEmail: auth.email,
      planId: parsed.data.planId,
      recipientUsername: parsed.data.recipientUsername,
      months: parsed.data.months,
      message: parsed.data.message,
    });

    return { success: true, data: { checkoutUrl: result.authorizationUrl } };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start gift checkout.";
    return { success: false, error: message };
  }
}
