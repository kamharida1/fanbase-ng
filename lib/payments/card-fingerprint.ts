import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";

// Cards shared across this many distinct accounts within 30 days → flag all.
const CARD_SHARING_THRESHOLD = 3;
const CARD_SHARING_WINDOW_DAYS = 30;

export async function storeCardFingerprintAndCheck(
  admin: SupabaseClient,
  input: {
    signature: string;
    authorizationCode: string;
    last4?: string | null;
    bank?: string | null;
    cardType?: string | null;
    payerId: string;
  },
): Promise<void> {
  const { error: upsertError } = await admin
    .from("payment_authorizations")
    .upsert(
      {
        signature: input.signature,
        authorization_code: input.authorizationCode,
        last4: input.last4 ?? null,
        bank: input.bank ?? null,
        card_type: input.cardType ?? null,
        payer_id: input.payerId,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "signature,payer_id", ignoreDuplicates: false },
    );

  if (upsertError) {
    logger.warn("card_fingerprint.upsert_failed", {
      err: upsertError,
      payerId: input.payerId,
    });
    return;
  }

  const since = new Date(
    Date.now() - CARD_SHARING_WINDOW_DAYS * 86_400_000,
  ).toISOString();

  const { data: rows, error: queryError } = await admin
    .from("payment_authorizations")
    .select("payer_id")
    .eq("signature", input.signature)
    .gte("last_seen_at", since);

  if (queryError || !rows) return;

  const distinctPayers = [...new Set(rows.map((r) => r.payer_id as string))];

  if (distinctPayers.length < CARD_SHARING_THRESHOLD) return;

  // Flag every account sharing this card to the moderation queue.
  await Promise.allSettled(
    distinctPayers.map(async (payerId) => {
      try {
        await admin.from("moderation_queue").upsert(
          {
            entity_type: "user",
            entity_id: payerId,
            priority_score: 380,
            flags: {
              card_sharing: true,
              card_last4: input.last4,
              card_bank: input.bank,
              card_type: input.cardType,
              sharing_count: distinctPayers.length,
              all_payer_ids: distinctPayers,
            },
          },
          { onConflict: "entity_type,entity_id", ignoreDuplicates: false },
        );

        await writeAuditLog(admin, {
          actorId: payerId,
          actorType: "system",
          action: "payment.card_sharing_flagged",
          entityType: "profiles",
          entityId: payerId,
          metadata: {
            card_last4: input.last4,
            card_bank: input.bank,
            sharing_count: distinctPayers.length,
          },
        });
      } catch (err) {
        logger.warn("card_fingerprint.flag_failed", { err, payerId });
      }
    }),
  );
}
