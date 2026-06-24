"use server";

import {
  buildPaymentReference,
  initializePaymentCheckout,
} from "@/lib/paystack/checkout";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type MessagePpvCheckoutResult =
  | { success: true; authorizationUrl: string }
  | { success: false; error: string };

export async function startMessagePpvPurchase(
  messageId: string,
  messageCreatedAt: string,
): Promise<MessagePpvCheckoutResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (!auth.email) {
    return { success: false, error: "Email required for checkout." };
  }

  const { data: message } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, is_ppv, ppv_price_kobo, created_at")
    .eq("id", messageId)
    .eq("created_at", messageCreatedAt)
    .maybeSingle();

  if (!message) return { success: false, error: "Message not found." };
  if (!message.is_ppv || !message.ppv_price_kobo) {
    return { success: false, error: "This message is not pay-per-view." };
  }
  if (message.sender_id === auth.userId) {
    return { success: false, error: "You can't unlock your own message." };
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, creator_id, fan_id")
    .eq("id", message.conversation_id)
    .maybeSingle();

  if (!conversation || conversation.fan_id !== auth.userId) {
    return { success: false, error: "Message not found." };
  }

  const { data: existing } = await supabase
    .from("message_purchases")
    .select("id")
    .eq("fan_id", auth.userId)
    .eq("message_id", message.id)
    .eq("message_created_at", message.created_at)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "You already unlocked this message." };
  }

  const { data: fanProfile } = await supabase
    .from("profiles")
    .select("payment_suspended")
    .eq("id", auth.userId)
    .single();

  if (fanProfile?.payment_suspended) {
    return {
      success: false,
      error:
        "Your payment capability has been suspended. Please contact support to resolve this.",
    };
  }

  const reference = buildPaymentReference().replace("fb_sub_", "fb_dmppv_");
  const callbackUrl = `${APP_URL}/messages?ppv=success&reference=${encodeURIComponent(reference)}`;

  const { error: paymentError } = await supabase.from("payments").insert({
    payer_id: auth.userId,
    paystack_reference: reference,
    amount_kobo: message.ppv_price_kobo,
    currency: "NGN",
    type: "ppv",
    status: "pending",
    creator_id: conversation.creator_id,
    message_id: message.id,
    idempotency_key: reference,
    metadata: {
      purpose: "message_ppv_purchase",
      message_id: message.id,
      message_created_at: message.created_at,
      creator_id: conversation.creator_id,
      fan_id: auth.userId,
    },
  });

  if (paymentError) {
    return { success: false, error: "Could not start checkout." };
  }

  try {
    const checkout = await initializePaymentCheckout({
      email: auth.email,
      amountKobo: message.ppv_price_kobo,
      reference,
      callbackUrl,
      metadata: {
        fan_id: auth.userId,
        message_id: message.id,
        creator_id: conversation.creator_id,
        purpose: "message_ppv_purchase",
      },
    });

    return { success: true, authorizationUrl: checkout.authorization_url };
  } catch (err) {
    const message2 = err instanceof Error ? err.message : "Checkout failed";
    return { success: false, error: message2 };
  }
}
