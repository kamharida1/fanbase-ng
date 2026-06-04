import { BalanceCards } from "@/components/wallet/balance-cards";
import { EarningsTable } from "@/components/wallet/earnings-table";
import { TransactionList } from "@/components/wallet/transaction-list";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import {
  getCreatorWallet,
  getEarningsTotals,
  listEarningsDaily,
  listWalletTransactions,
} from "@/lib/earnings";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CreatorEarningsPage() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/creator/earnings");

  const wallet = await getCreatorWallet(supabase, auth.userId);
  const earnings30d = await getEarningsTotals(supabase, auth.userId, 30);
  const daily = await listEarningsDaily(supabase, auth.userId, 30);
  const transactions = wallet
    ? await listWalletTransactions(supabase, wallet.id, 50)
    : [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Earnings</h1>
        <p className="mt-2 text-muted-foreground">
          Available balance, pending clearance, daily totals, and ledger history.
        </p>
      </div>

      <BalanceCards wallet={wallet} earnings30dNet={earnings30d.net_kobo} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Daily earnings (30 days)</h2>
        <EarningsTable rows={daily} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Transaction history</h2>
        <TransactionList transactions={transactions} />
      </section>
    </div>
  );
}
