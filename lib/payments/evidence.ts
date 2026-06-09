import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

/**
 * Compiles a structured evidence snapshot for a chargeback dispute and stores
 * it in disputes.metadata.evidence so the creator can copy-paste it directly
 * into the Paystack dispute portal without manual research.
 *
 * Covers: subscription history, payment details, and a plain-language summary.
 */
export async function compileDisputeEvidence(
  admin: SupabaseClient,
  input: {
    disputeId: string;
    fanId: string | null;
    creatorId: string | null;
    paymentId: string;
  },
): Promise<void> {
  try {
    const [paymentResult, subscriptionsResult, allPaymentsResult, profileResult] =
      await Promise.all([
        // The specific payment being disputed
        admin
          .from("payments")
          .select(
            "id, amount_kobo, currency, status, paystack_reference, paystack_transaction_id, created_at, metadata",
          )
          .eq("id", input.paymentId)
          .single(),

        // Fan's full subscription history with this creator
        input.fanId && input.creatorId
          ? admin
              .from("subscriptions")
              .select(
                "id, status, current_period_start, current_period_end, started_at, ended_at, subscription_plans(name, price_kobo, billing_interval)",
              )
              .eq("fan_id", input.fanId)
              .eq("creator_id", input.creatorId)
              .order("started_at", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: null }),

        // All payments from this fan to this creator (pattern evidence)
        input.fanId && input.creatorId
          ? admin
              .from("payments")
              .select("id, amount_kobo, status, paystack_reference, created_at, type")
              .eq("payer_id", input.fanId)
              .eq("creator_id", input.creatorId)
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: null }),

        // Fan's profile info for evidence header
        input.fanId
          ? admin
              .from("profiles")
              .select("username, display_name, created_at, chargeback_loss_count")
              .eq("id", input.fanId)
              .single()
          : Promise.resolve({ data: null }),
      ]);

    const payment = paymentResult.data;
    const subscriptions = subscriptionsResult.data ?? [];
    const allPayments = allPaymentsResult.data ?? [];
    const fanProfile = profileResult.data;

    const amountNgn = payment
      ? (payment.amount_kobo / 100).toLocaleString("en-NG", {
          style: "currency",
          currency: "NGN",
          minimumFractionDigits: 0,
        })
      : "unknown";

    const activeSubs = (subscriptions as Array<Record<string, unknown>>).filter(
      (s) => s.status === "active" || s.status === "past_due",
    );

    const summary = [
      `DISPUTE EVIDENCE — generated ${new Date().toISOString()}`,
      ``,
      `DISPUTED PAYMENT`,
      `  Reference:      ${payment?.paystack_reference ?? "N/A"}`,
      `  Transaction ID: ${payment?.paystack_transaction_id ?? "N/A"}`,
      `  Amount:         ${amountNgn}`,
      `  Date:           ${payment?.created_at ? new Date(payment.created_at).toUTCString() : "N/A"}`,
      `  Status at time: ${payment?.status ?? "N/A"}`,
      ``,
      `FAN ACCOUNT`,
      `  User ID:        ${input.fanId ?? "N/A"}`,
      `  Username:       ${fanProfile?.username ?? "N/A"}`,
      `  Display name:   ${fanProfile?.display_name ?? "N/A"}`,
      `  Registered:     ${fanProfile?.created_at ? new Date(fanProfile.created_at).toUTCString() : "N/A"}`,
      `  Past CB losses: ${fanProfile?.chargeback_loss_count ?? 0}`,
      ``,
      `SUBSCRIPTION HISTORY (fan ↔ this creator)`,
      ...(subscriptions as Array<Record<string, unknown>>).map((s) => {
        const plan = s.subscription_plans as Record<string, unknown> | null;
        return (
          `  - ${plan?.name ?? "Plan"} | ` +
          `${s.started_at ? new Date(s.started_at as string).toDateString() : "?"} → ` +
          `${s.ended_at ? new Date(s.ended_at as string).toDateString() : s.status === "active" ? "ACTIVE" : "?"} | ` +
          `Status: ${s.status}`
        );
      }),
      subscriptions.length === 0 ? "  (none)" : "",
      ``,
      `ALL PAYMENTS (fan → this creator, newest first)`,
      ...(allPayments as Array<Record<string, unknown>>).map(
        (p) =>
          `  - ${p.paystack_reference} | ` +
          `${(p.amount_kobo as number) / 100} NGN | ` +
          `${p.type} | ` +
          `${p.status} | ` +
          `${p.created_at ? new Date(p.created_at as string).toDateString() : "?"}`,
      ),
      allPayments.length === 0 ? "  (none)" : "",
      ``,
      `ACTIVE SUBSCRIPTIONS AT DISPUTE TIME: ${activeSubs.length}`,
      activeSubs.length > 0
        ? "  Fan had active access to your content at the time the chargeback was filed."
        : "  No active subscriptions at dispute time.",
    ]
      .filter((l) => l !== "")
      .join("\n");

    const evidencePayload = {
      generated_at: new Date().toISOString(),
      fan_id: input.fanId,
      creator_id: input.creatorId,
      payment: {
        id: payment?.id,
        reference: payment?.paystack_reference,
        transaction_id: payment?.paystack_transaction_id,
        amount_kobo: payment?.amount_kobo,
        created_at: payment?.created_at,
      },
      subscription_history: subscriptions,
      all_payments: allPayments,
      summary_text: summary,
    };

    await admin
      .from("disputes")
      .update({
        metadata: { evidence: evidencePayload },
        evidence_compiled_at: new Date().toISOString(),
      })
      .eq("id", input.disputeId);
  } catch (err) {
    logger.warn("disputes.evidence_compile_failed", { err, disputeId: input.disputeId });
  }
}
