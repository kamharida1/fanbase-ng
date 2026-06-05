import { redirect } from "next/navigation";

import { ReferralCard } from "@/components/referrals/referral-card";
import { requireAuth } from "@/lib/auth/get-auth-context";
import {
  getOrCreateReferralCode,
  getReferralStats,
  listReferrals,
} from "@/lib/referrals/queries";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fanbaseng.com";

export default async function ReferralsPage() {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  if (!auth) redirect("/login?next=/referrals");

  const [codeRow, stats, referrals] = await Promise.all([
    getOrCreateReferralCode(supabase, auth.userId),
    getReferralStats(supabase, auth.userId),
    listReferrals(supabase, auth.userId),
  ]);

  const referralLink = codeRow
    ? `${APP_URL}/signup?ref=${codeRow.code}`
    : `${APP_URL}/signup`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Refer & earn</h1>
        <p className="mt-2 text-muted-foreground">
          Share your referral link. When someone signs up and makes their first
          subscription payment, you earn <strong>5%</strong> of that payment
          straight to your Naira wallet.
        </p>
      </div>

      <ReferralCard
        referralLink={referralLink}
        stats={stats}
        referrals={referrals}
      />

      <section className="rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold">How it works</h2>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">1</span>
            <span>Copy your referral link and share it on WhatsApp, Instagram, X, or anywhere your audience is.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">2</span>
            <span>When someone signs up using your link, they are tracked as your referral.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">3</span>
            <span>Once they subscribe to any creator for the first time, you earn 5% of their payment — credited instantly to your Naira wallet.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">4</span>
            <span>Withdraw your referral earnings alongside your other earnings at any time.</span>
          </li>
        </ol>
      </section>
    </div>
  );
}
