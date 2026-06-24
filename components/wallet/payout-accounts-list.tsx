"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { deletePayoutAccount, setDefaultPayoutAccount } from "@/lib/wallets/actions";
import type { PayoutAccountRow } from "@/types/wallet";
import { Button } from "@/components/ui/button";

export function PayoutAccountsList({ accounts }: { accounts: PayoutAccountRow[] }) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No payout accounts yet.</p>
    );
  }

  async function makeDefault(id: string) {
    await setDefaultPayoutAccount(id);
    router.refresh();
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError(null);
    const result = await deletePayoutAccount(id);
    setRemovingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}
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
            <div className="flex shrink-0 gap-2">
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removingId === account.id}
                onClick={() => void handleRemove(account.id)}
              >
                {removingId === account.id ? "Removing…" : "Remove"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
