import type { SupabaseClient } from "@supabase/supabase-js";

export async function notifyWalletClearances(
  admin: SupabaseClient,
  sinceIso: string,
): Promise<number> {
  const { data: rows } = await admin
    .from("wallet_transactions")
    .select("id, amount_kobo, wallet_id, wallets!inner(owner_id)")
    .eq("type", "clearance_credit")
    .gte("created_at", sinceIso)
    .limit(100);

  if (!rows?.length) return 0;

  const { notifyWalletCleared } = await import("@/lib/notifications/emit");
  let sent = 0;

  for (const row of rows) {
    const wallet = Array.isArray(row.wallets) ? row.wallets[0] : row.wallets;
    const ownerId = (wallet as { owner_id?: string } | null)?.owner_id;
    if (!ownerId || row.amount_kobo <= 0) continue;

    await notifyWalletCleared(admin, {
      creatorId: ownerId,
      amountKobo: row.amount_kobo,
      transactionId: row.id,
    });
    sent += 1;
  }

  return sent;
}
