import { BalanceCards } from "@/components/wallet/balance-cards";
import { PayoutRequirementsNotice } from "@/components/wallet/payout-requirements-notice";
import { PayoutAccountForm } from "@/components/wallet/payout-account-form";
import { PayoutAccountsList } from "@/components/wallet/payout-accounts-list";
import { PayoutRequestList } from "@/components/wallet/payout-request-list";
import { WithdrawalForm } from "@/components/wallet/withdrawal-form";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { listNigerianBanks } from "@/lib/paystack/banks";
import {
  getCreatorWallet,
  listPayoutAccounts,
  listPayoutRequests,
} from "@/lib/wallets/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CreatorWithdrawalsPage() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/creator/withdrawals");

  const wallet = await getCreatorWallet(supabase, auth.userId);
  const accounts = await listPayoutAccounts(supabase, auth.userId);
  const requests = await listPayoutRequests(supabase, auth.userId);

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", auth.userId)
    .single();

  const kycStatus =
    (profileRow?.kyc_status as "none" | "pending" | "verified" | "rejected") ??
    "none";

  let banks: Awaited<ReturnType<typeof listNigerianBanks>> = [];
  try {
    banks = await listNigerianBanks();
  } catch {
    banks = [];
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <p className="mt-2 text-muted-foreground">
          Request payouts to verified Nigerian bank accounts.
        </p>
      </div>

      <PayoutRequirementsNotice kycStatus={kycStatus} />

      <BalanceCards wallet={wallet} />

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Request withdrawal</h2>
          <WithdrawalForm
            accounts={accounts}
            availableKobo={wallet?.available_kobo ?? 0}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Add bank account</h2>
          <PayoutAccountForm banks={banks} />
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Payout accounts</h2>
        <PayoutAccountsList accounts={accounts} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Withdrawal history</h2>
        <PayoutRequestList requests={requests} />
      </section>
    </div>
  );
}
