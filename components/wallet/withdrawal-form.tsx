"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { requestWithdrawal } from "@/lib/wallets/actions";
import { MIN_WITHDRAWAL_KOBO } from "@/lib/wallets/constants";
import { formatNgnFromKobo } from "@/lib/wallets/format";
import { koboToNgn } from "@/lib/creators/schemas";
import type { PayoutAccountRow } from "@/types/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WithdrawalForm({
  accounts,
  availableKobo,
}: {
  accounts: PayoutAccountRow[];
  availableKobo: number;
}) {
  const router = useRouter();
  const verified = accounts.filter((a) => a.is_verified);
  const defaultAccount =
    verified.find((a) => a.is_default) ?? verified[0] ?? null;

  const [accountId, setAccountId] = useState(defaultAccount?.id ?? "");
  const [amountNgn, setAmountNgn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await requestWithdrawal({
      payout_account_id: accountId,
      amount_ngn: parseFloat(amountNgn) || 0,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setAmountNgn("");
    router.refresh();
  }

  if (verified.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a verified bank account before requesting a withdrawal.
      </p>
    );
  }

  const maxNgn = koboToNgn(availableKobo);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Available: {formatNgnFromKobo(availableKobo)} · Min:{" "}
        {formatNgnFromKobo(MIN_WITHDRAWAL_KOBO)}
      </p>
      <div className="space-y-2">
        <Label htmlFor="payoutAccount">Payout account</Label>
        <select
          id="payoutAccount"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
        >
          {verified.map((account) => (
            <option key={account.id} value={account.id}>
              {account.bank_name ?? "Bank"} · ****
              {account.account_number_last4} — {account.account_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="withdrawAmount">Amount (NGN)</Label>
        <Input
          id="withdrawAmount"
          type="number"
          min={MIN_WITHDRAWAL_KOBO / 100}
          max={maxNgn}
          step={100}
          required
          value={amountNgn}
          onChange={(e) => setAmountNgn(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => setAmountNgn(String(maxNgn))}
        >
          Withdraw maximum
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading || availableKobo < MIN_WITHDRAWAL_KOBO}>
        {loading ? "Submitting…" : "Request withdrawal"}
      </Button>
    </form>
  );
}
