"use client";

import { useRouter } from "next/navigation";

import { setDefaultPayoutAccount } from "@/lib/wallets/actions";
import type { PayoutAccountRow } from "@/types/wallet";
import { Button } from "@/components/ui/button";

export function PayoutAccountsList({ accounts }: { accounts: PayoutAccountRow[] }) {
  const router = useRouter();

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No payout accounts yet.</p>
    );
  }

  async function makeDefault(id: string) {
    await setDefaultPayoutAccount(id);
    router.refresh();
  }

  return (
    <ul className="divide-y rounded-xl border">
      {accounts.map((account) => (
        <li
          key={account.id}
          className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">
              {account.bank_name ?? "Bank"} · ****{account.account_number_last4}
            </p>
            <p className="text-sm text-muted-foreground">{account.account_name}</p>
            <p className="text-xs text-muted-foreground">
              {account.is_verified ? "Verified" : "Pending verification"}
              {account.is_default ? " · Default" : ""}
            </p>
          </div>
          {!account.is_default && account.is_verified ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => makeDefault(account.id)}
            >
              Set default
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
