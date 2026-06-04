"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addPayoutAccount } from "@/lib/wallets/actions";
import type { PaystackBank } from "@/lib/paystack/banks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PayoutAccountForm({ banks }: { banks: PaystackBank[] }) {
  const router = useRouter();
  const [bankCode, setBankCode] = useState(banks[0]?.code ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBank = banks.find((b) => b.code === bankCode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await addPayoutAccount({
      bank_code: bankCode,
      bank_name: selectedBank?.name ?? "Bank",
      account_number: accountNumber,
      account_name: accountName,
      set_default: true,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setAccountNumber("");
    setAccountName("");
    router.refresh();
  }

  if (banks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Bank list unavailable. Configure Paystack keys to add accounts.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bank">Bank</Label>
        <select
          id="bank"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
          required
        >
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="accountNumber">Account number</Label>
        <Input
          id="accountNumber"
          inputMode="numeric"
          pattern="\d{10}"
          maxLength={10}
          required
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
          placeholder="0123456789"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accountName">Account name</Label>
        <Input
          id="accountName"
          required
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="As on bank account (verified via Paystack)"
        />
        <p className="text-xs text-muted-foreground">
          Name is re-verified with Paystack when you save.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Verifying…" : "Add bank account"}
      </Button>
    </form>
  );
}
