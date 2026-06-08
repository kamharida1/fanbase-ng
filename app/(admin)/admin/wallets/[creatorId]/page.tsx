import Link from "next/link";
import { notFound } from "next/navigation";

import { WalletLedgerPanel } from "@/components/admin/wallet-ledger-panel";
import { getAdminCreatorWalletDetail } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminCreatorWalletPage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const { creatorId } = await params;
  const admin = await createStaffAdminClient();
  const detail = await getAdminCreatorWalletDetail(admin, creatorId);

  if (!detail.wallet) notFound();

  const { wallet, transactions, disputes, payouts } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/finance" className="text-sm text-muted-foreground hover:underline">
          ← Back to financial reports
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          @{wallet.creator_username ?? "?"}
          {wallet.display_name ? (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              {wallet.display_name}
            </span>
          ) : null}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Wallet balances, dispute history, payout requests, and the full
          transaction ledger for this creator — use this to reconcile a
          dispute or debt against payout history.
        </p>
      </div>
      <WalletLedgerPanel
        wallet={wallet}
        transactions={transactions}
        disputes={disputes}
        payouts={payouts}
      />
    </div>
  );
}
