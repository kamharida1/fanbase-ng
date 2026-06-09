"use server";

import {
  buildPaymentReference,
  initializePaymentCheckout,
} from "@/lib/paystack/checkout";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { getPostById } from "@/lib/posts/queries";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type PpvCheckoutResult =
  | { success: true; authorizationUrl: string }
  | { success: false; error: string };

export async function startPpvPurchase(postId: string): Promise<PpvCheckoutResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (!auth.email) {
    return { success: false, error: "Email required for checkout." };
  }

  const post = await getPostById(supabase, postId, auth.userId);
  if (!post) return { success: false, error: "Post not found." };
  if (post.visibility !== "ppv" || !post.ppv_price_kobo) {
    return { success: false, error: "This post is not pay-per-view." };
  }
  if (post.can_view_full) {
    return { success: false, error: "You already unlocked this post." };
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

  const reference = buildPaymentReference().replace("fb_sub_", "fb_ppv_");
  const callbackUrl = `${APP_URL}/feed?ppv=success&reference=${encodeURIComponent(reference)}`;

  const { error: paymentError } = await supabase.from("payments").insert({
    payer_id: auth.userId,
    paystack_reference: reference,
    amount_kobo: post.ppv_price_kobo,
    currency: "NGN",
    type: "ppv",
    status: "pending",
    creator_id: post.creator_id,
    post_id: post.id,
    idempotency_key: reference,
    metadata: {
      purpose: "ppv_purchase",
      post_id: post.id,
      creator_id: post.creator_id,
      fan_id: auth.userId,
    },
  });

  if (paymentError) {
    return { success: false, error: "Could not start checkout." };
  }

  try {
    const checkout = await initializePaymentCheckout({
      email: auth.email,
      amountKobo: post.ppv_price_kobo,
      reference,
      callbackUrl,
      metadata: {
        fan_id: auth.userId,
        post_id: post.id,
        creator_id: post.creator_id,
        purpose: "ppv_purchase",
      },
    });

    return { success: true, authorizationUrl: checkout.authorization_url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return { success: false, error: message };
  }
}
