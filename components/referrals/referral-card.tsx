"use client";

import { useState } from "react";
import { Check, Copy, Share2, Users } from "lucide-react";

import { formatNgnFromKobo } from "@/lib/creators/format";
import type { ReferralRow } from "@/lib/referrals/queries";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: "Signed up",  color: "text-muted-foreground" },
  qualified: { label: "Subscribed", color: "text-amber-600 dark:text-amber-400" },
  rewarded:  { label: "Rewarded ✓", color: "text-green-600 dark:text-green-400" },
  expired:   { label: "Expired",    color: "text-muted-foreground" },
  rejected:  { label: "Rejected",   color: "text-destructive" },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(iso));
}

type Props = {
  referralLink: string;
  stats: { totalReferrals: number; qualifiedReferrals: number; totalEarnedKobo: number };
  referrals: ReferralRow[];
};

export function ReferralCard({ referralLink, stats, referrals }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join me on Fanbase NG",
          text: "Sign up using my referral link and let's both earn together.",
          url: referralLink,
        });
        return;
      } catch { /* cancelled */ }
    }
    copy();
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total referred", value: stats.totalReferrals.toString() },
          { label: "Subscribed",     value: stats.qualifiedReferrals.toString() },
          { label: "Total earned",   value: formatNgnFromKobo(stats.totalEarnedKobo) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="rounded-xl border p-5 space-y-3">
        <p className="text-sm font-medium">Your referral link</p>
        <div className="flex min-w-0 gap-2">
          <input
            readOnly
            value={referralLink}
            className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm font-mono"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={share}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          When someone signs up using your link and makes their first subscription payment,
          you earn <strong>5% of that payment</strong> credited to your Naira wallet.
        </p>
      </div>

      {/* Referral list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">People you referred</h2>
        {referrals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">No referrals yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Share your link on WhatsApp, Instagram, or X to get started.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {referrals.map((r) => {
              const st = STATUS_LABELS[r.status] ?? { label: r.status, color: "" };
              return (
                <li key={r.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">
                      {r.referee_username ? `@${r.referee_username}` : "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDate(r.created_at)}
                    </p>
                  </div>
                  <span className={`text-sm font-medium ${st.color}`}>
                    {st.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
