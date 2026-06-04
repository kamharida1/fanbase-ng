import { formatNgnFromKobo, walletTxLabel } from "@/lib/wallets/format";
import type { WalletTransactionRow } from "@/types/wallet";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function TransactionList({
  transactions,
  emptyMessage = "No transactions yet.",
}: {
  transactions: WalletTransactionRow[];
  emptyMessage?: string;
}) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {transactions.map((tx) => {
        const positive = tx.amount_kobo > 0;
        return (
          <li
            key={`${tx.id}-${tx.created_at}`}
            className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{walletTxLabel(tx.type)}</p>
              {tx.description ? (
                <p className="text-sm text-muted-foreground">{tx.description}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {formatWhen(tx.created_at)}
                {tx.clears_at && !tx.metadata?.cleared ? (
                  <> · clears {formatWhen(tx.clears_at)}</>
                ) : null}
              </p>
            </div>
            <div className="text-right">
              <p
                className={
                  positive
                    ? "font-semibold text-green-700 dark:text-green-400"
                    : "font-semibold text-foreground"
                }
              >
                {positive ? "+" : ""}
                {formatNgnFromKobo(tx.amount_kobo)}
              </p>
              <p className="text-xs text-muted-foreground">
                Avail. {formatNgnFromKobo(tx.balance_available_after_kobo)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
