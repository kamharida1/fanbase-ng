"use client";

import { useEffect, useState } from "react";

import { formatNgnFromKobo } from "@/lib/creators/format";
import type { OfferRow } from "@/lib/offers/queries";

function useCountdown(endsAt: string) {
  const [ms, setMs] = useState(() => new Date(endsAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setMs(new Date(endsAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return ms;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

type Props = {
  offer: OfferRow;
  originalKobo: number;
};

export function OfferBadge({ offer, originalKobo }: Props) {
  const ms = useCountdown(offer.ends_at);
  const discountedKobo = Math.round(
    originalKobo * (1 - offer.discount_pct / 100),
  );

  if (ms <= 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold text-amber-800 dark:text-amber-200">
          {offer.discount_pct}% off
        </span>
        <span className="text-muted-foreground line-through">
          {formatNgnFromKobo(originalKobo)}
        </span>
        <span className="font-bold text-green-700 dark:text-green-400">
          {formatNgnFromKobo(discountedKobo)}/first month
        </span>
      </div>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
        {offer.label} · {formatCountdown(ms)}
        {offer.max_redemptions != null
          ? ` · ${offer.max_redemptions - offer.redemption_count} left`
          : ""}
      </p>
    </div>
  );
}
