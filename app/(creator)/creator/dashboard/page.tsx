import Link from "next/link";

import { CreatePostPrompt } from "@/components/posts/create-post-prompt";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { BalanceCards } from "@/components/wallet/balance-cards";
import { TransactionList } from "@/components/wallet/transaction-list";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getCreatorOnboardingStatus } from "@/lib/onboarding/queries";
import { getCreatorWalletOverview } from "@/lib/wallets/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CreatorDashboardPage() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/creator/dashboard");

  const [overview, onboarding] = await Promise.all([
    getCreatorWalletOverview(supabase, auth.userId),
    getCreatorOnboardingStatus(supabase, auth.userId),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Creator dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Earnings overview and recent wallet activity.
        </p>
      </div>

      <CreatePostPrompt />

      <OnboardingChecklist status={onboarding} />

      <BalanceCards
        wallet={overview.wallet}
        earnings30dNet={overview.earnings30d.net_kobo}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent transactions</h2>
          <Link href="/creator/earnings" className="text-sm font-medium underline">
            View all
          </Link>
        </div>
        <TransactionList transactions={overview.recentTransactions} />
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/creator/withdrawals"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Withdraw funds
        </Link>
        <Link
          href="/creator/tiers"
          className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium"
        >
          Manage tiers
        </Link>
      </div>
    </div>
  );
}
