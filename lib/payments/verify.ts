import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { verifyPaystackTransaction } from "@/lib/paystack/transactions";
import { chargeAmountMatchesPayment } from "@/lib/security/payment-amount";
import { fulfillPpvPurchase } from "@/lib/payments/ppv-processor";
import { fulfillMessagePpvPurchase } from "@/lib/payments/message-ppv-processor";
import {
  failSubscriptionPayment,
  fulfillSubscriptionPayment,
  getPaymentByReference,
} from "@/lib/payments/processor";

export type VerifyPaymentResult =
  | {
      status: "success";
      kind: "subscription";
      subscriptionId: string;
      paymentId: string;
      reference: string;
    }
  | {
      status: "success";
      kind: "ppv";
      postId: string;
      paymentId: string;
      reference: string;
    }
  | {
      status: "success";
      kind: "message_ppv";
      messageId: string;
      paymentId: string;
      reference: string;
    }
  | { status: "pending"; reference: string; message: string }
  | { status: "failed"; reference: string; reason: string }
  | { status: "not_found"; reference: string }
  | { status: "forbidden"; reference: string };

function isPpvPayment(payment: {
  type?: string | null;
  post_id?: string | null;
  metadata: Record<string, unknown>;
}): boolean {
  if (payment.metadata?.purpose === "message_ppv_purchase") return false;
  if (payment.type === "ppv") return true;
  const meta = payment.metadata;
  return meta?.purpose === "ppv_purchase";
}

function isMessagePpvPayment(payment: {
  type?: string | null;
  message_id?: string | null;
  metadata: Record<string, unknown>;
}): boolean {
  if (payment.metadata?.purpose === "message_ppv_purchase") return true;
  return payment.type === "ppv" && Boolean(payment.message_id);
}

/**
 * Server-side verification after Paystack redirect (webhook may lag).
 * Idempotent: safe to call multiple times for the same reference.
 */
export async function verifyAndFulfillPayment(
  admin: SupabaseClient,
  input: {
    reference: string;
    fanId: string;
    requestId?: string | null;
  },
): Promise<VerifyPaymentResult> {
  const payment = await getPaymentByReference(admin, input.reference);

  if (!payment) {
    return { status: "not_found", reference: input.reference };
  }

  if (payment.payer_id !== input.fanId) {
    return { status: "forbidden", reference: input.reference };
  }

  const ppv = isPpvPayment(
    payment as {
      type?: string | null;
      post_id?: string | null;
      metadata: Record<string, unknown>;
    },
  );
  const messagePpv = isMessagePpvPayment(
    payment as {
      type?: string | null;
      message_id?: string | null;
      metadata: Record<string, unknown>;
    },
  );

  if (payment.status === "success" && ppv) {
    const postId =
      typeof (payment as { post_id?: string }).post_id === "string"
        ? (payment as { post_id: string }).post_id
        : typeof payment.metadata.post_id === "string"
          ? payment.metadata.post_id
          : null;
    if (postId) {
      return {
        status: "success",
        kind: "ppv",
        postId,
        paymentId: payment.id,
        reference: input.reference,
      };
    }
  }

  if (payment.status === "success" && messagePpv) {
    const messageId =
      typeof (payment as { message_id?: string }).message_id === "string"
        ? (payment as { message_id: string }).message_id
        : typeof payment.metadata.message_id === "string"
          ? payment.metadata.message_id
          : null;
    if (messageId) {
      return {
        status: "success",
        kind: "message_ppv",
        messageId,
        paymentId: payment.id,
        reference: input.reference,
      };
    }
  }

  if (payment.status === "success" && payment.subscription_id) {
    return {
      status: "success",
      kind: "subscription",
      subscriptionId: payment.subscription_id,
      paymentId: payment.id,
      reference: input.reference,
    };
  }

  if (payment.status === "failed") {
    return {
      status: "failed",
      reference: input.reference,
      reason: "Payment failed at checkout.",
    };
  }

  let transaction;
  try {
    transaction = await verifyPaystackTransaction(input.reference);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return {
      status: "pending",
      reference: input.reference,
      message,
    };
  }

  await writeAuditLog(admin, {
    actorId: input.fanId,
    actorType: "user",
    action: "payment.verified",
    entityType: "payments",
    entityId: payment.id,
    requestId: input.requestId,
    afterState: {
      gateway_status: transaction.status,
      reference: input.reference,
    },
  });

  if (transaction.status === "failed" || transaction.status === "abandoned") {
    await failSubscriptionPayment(admin, {
      reference: input.reference,
      reason: `Paystack status: ${transaction.status}`,
      requestId: input.requestId,
      chargeData: transaction as unknown as Record<string, unknown>,
    });
    return {
      status: "failed",
      reference: input.reference,
      reason: `Payment ${transaction.status}.`,
    };
  }

  if (transaction.status !== "success") {
    return {
      status: "pending",
      reference: input.reference,
      message: `Payment is ${transaction.status}. Try again shortly.`,
    };
  }

  const gatewayAmount =
    typeof transaction.amount === "number" ? transaction.amount : 0;

  if (!chargeAmountMatchesPayment(gatewayAmount, payment.amount_kobo)) {
    return {
      status: "failed",
      reference: input.reference,
      reason: "Payment amount does not match checkout.",
    };
  }

  if (messagePpv) {
    const handled = await fulfillMessagePpvPurchase(admin, {
      chargeData: transaction as unknown as Record<string, unknown>,
      requestId: input.requestId,
    });

    if (!handled) {
      return {
        status: "failed",
        reference: input.reference,
        reason: "Payment succeeded but could not unlock this message.",
      };
    }

    const messageId =
      typeof payment.metadata.message_id === "string"
        ? payment.metadata.message_id
        : typeof (payment as { message_id?: string }).message_id === "string"
          ? (payment as { message_id: string }).message_id
          : "";

    return {
      status: "success",
      kind: "message_ppv",
      messageId,
      paymentId: payment.id,
      reference: input.reference,
    };
  }

  if (ppv) {
    const handled = await fulfillPpvPurchase(admin, {
      chargeData: transaction as unknown as Record<string, unknown>,
      requestId: input.requestId,
    });

    if (!handled) {
      return {
        status: "failed",
        reference: input.reference,
        reason: "Payment succeeded but could not unlock this post.",
      };
    }

    const postId =
      typeof payment.metadata.post_id === "string"
        ? payment.metadata.post_id
        : typeof (payment as { post_id?: string }).post_id === "string"
          ? (payment as { post_id: string }).post_id
          : "";

    return {
      status: "success",
      kind: "ppv",
      postId,
      paymentId: payment.id,
      reference: input.reference,
    };
  }

  const fulfilled = await fulfillSubscriptionPayment(admin, {
    chargeData: transaction as unknown as Record<string, unknown>,
    requestId: input.requestId,
    source: "verify",
  });

  if (!fulfilled) {
    return {
      status: "failed",
      reference: input.reference,
      reason: "Payment succeeded but is not a subscription checkout.",
    };
  }

  return {
    status: "success",
    kind: "subscription",
    subscriptionId: fulfilled.subscriptionId,
    paymentId: fulfilled.paymentId,
    reference: input.reference,
  };
}
