"use server";

import {
  buildPaymentReference,
  initializePaymentCheckout,
} from "@/lib/paystack/checkout";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { MIN_TIP_KOBO } from "@/lib/tips/constants";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type TipResult =
  | { success: true; authorizationUrl: string }
  | { success: false; error: string };

export async function startTip(input: {
  creatorId: string;
  creatorUsername: string;
  amountKobo: number;
}): Promise<TipResult> {
  if (input.amountKobo < MIN_TIP_KOBO) {
    return { success: false, error: "Minimum tip is ₦100." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (!auth.email) {
    return { success: false, error: "Account email is required for checkout." };
  }

  if (auth.userId === input.creatorId) {
    return { success: false, error: "You cannot tip yourself." };
  }

  const reference = buildPaymentReference().replace("fb_sub_", "fb_tip_");
  const callbackUrl = `${APP_URL}/creators/${encodeURIComponent(input.creatorUsername)}?tip=success&reference=${encodeURIComponent(reference)}`;

  const { error: paymentError } = await supabase.from("payments").insert({
    payer_id: auth.userId,
    paystack_reference: reference,
    amount_kobo: input.amountKobo,
    currency: "NGN",
    type: "tip",
    status: "pending",
    creator_id: input.creatorId,
    idempotency_key: reference,
    metadata: {
      purpose: "tip",
      fan_id: auth.userId,
      creator_id: input.creatorId,
    },
  });

  if (paymentError) {
    return { success: false, error: "Could not start checkout. Please try again." };
  }

  try {
    const checkout = await initializePaymentCheckout({
      email: auth.email,
      amountKobo: input.amountKobo,
      reference,
      callbackUrl,
      metadata: {
        purpose: "tip",
        fan_id: auth.userId,
        creator_id: input.creatorId,
      },
    });
    return { success: true, authorizationUrl: checkout.authorization_url };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Checkout failed.",
    };
  }
}
