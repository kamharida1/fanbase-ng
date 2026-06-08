"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, X } from "lucide-react";

import { createPlanBundle, deactivatePlanBundle } from "@/lib/subscriptions/bundle-actions";
import { formatNgnFromKobo } from "@/lib/creators/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SubscriptionPlanBundleRow } from "@/types/subscription";

type PlanOption = { id: string; name: string; price_kobo: number };

type Props = {
  plans: PlanOption[];
  bundles: SubscriptionPlanBundleRow[];
};

const MONTH_OPTIONS = [3, 6, 12] as const;

export function BundleManager({ plans, bundles }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [months, setMonths] = useState<number>(3);
  const [discountPct, setDiscountPct] = useState("15");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setLoading(true);
    const result = await createPlanBundle({
      planId,
      months,
      discountPct: parseInt(discountPct, 10),
    });
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setCreating(false);
    router.refresh();
  }

  async function handleDeactivate(bundleId: string) {
    await deactivatePlanBundle(bundleId);
    router.refresh();
  }

  const activeBundles = bundles.filter((b) => b.is_active);
  const selectedPlan = plans.find((p) => p.id === planId);
  const pct = parseInt(discountPct || "0", 10);
  const totalKobo = selectedPlan ? selectedPlan.price_kobo * months : 0;
  const discountedKobo = Math.round(totalKobo * (1 - pct / 100));

  return (
    <div className="space-y-4">
      {activeBundles.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {activeBundles.map((bundle) => {
            const plan = plans.find((p) => p.id === bundle.plan_id);
            const total = plan ? plan.price_kobo * bundle.months : 0;
            const discounted = Math.round(total * (1 - bundle.discount_pct / 100));
            return (
              <li key={bundle.id} className="flex min-w-0 items-center gap-4 p-4">
                <Package className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {bundle.months}-month bundle · {plan?.name ?? "plan"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {bundle.discount_pct}% off ·{" "}
                    {plan ? (
                      <>
                        {formatNgnFromKobo(discounted)}{" "}
                        <span className="line-through">{formatNgnFromKobo(total)}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeactivate(bundle.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remove bundle"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating ? (
        <div className="rounded-xl border p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatNgnFromKobo(p.price_kobo)}/mo)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={months}
                onChange={(e) => setMonths(parseInt(e.target.value, 10))}
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} months
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Discount %</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
              />
            </div>
          </div>
          {selectedPlan && (
            <p className="text-sm text-muted-foreground">
              Fans pay{" "}
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                {formatNgnFromKobo(discountedKobo)}
              </span>{" "}
              upfront for {months} months (was {formatNgnFromKobo(totalKobo)}) — a
              one-time charge with no auto-renewal.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={loading || !planId}>
              Create bundle
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setCreating(true)}
          disabled={plans.length === 0}
        >
          <Package className="h-4 w-4" />
          Add prepaid bundle
        </Button>
      )}
    </div>
  );
}
