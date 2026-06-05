"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag, X } from "lucide-react";

import { createOffer, deactivateOffer } from "@/lib/offers/actions";
import { formatNgnFromKobo } from "@/lib/creators/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OfferRow } from "@/lib/offers/queries";

type PlanOption = { id: string; name: string; price_kobo: number };

type Props = {
  plans: PlanOption[];
  offers: OfferRow[];
};

export function OfferManager({ plans, offers }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [discountPct, setDiscountPct] = useState("20");
  const [durationHours, setDurationHours] = useState("24");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setLoading(true);
    const result = await createOffer({
      planId,
      label: label || `${discountPct}% off for new subscribers`,
      discountPct: parseInt(discountPct, 10),
      durationHours: parseInt(durationHours, 10),
      maxRedemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : undefined,
    });
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setCreating(false);
    setLabel("");
    router.refresh();
  }

  async function handleDeactivate(offerId: string) {
    await deactivateOffer(offerId);
    router.refresh();
  }

  const activeOffers = offers.filter(
    (o) => o.is_active && new Date(o.ends_at) > new Date(),
  );

  const selectedPlan = plans.find((p) => p.id === planId);
  const discountedKobo = selectedPlan
    ? Math.round(selectedPlan.price_kobo * (1 - parseInt(discountPct || "0", 10) / 100))
    : 0;

  return (
    <div className="space-y-4">
      {activeOffers.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {activeOffers.map((offer) => {
            const plan = plans.find((p) => p.id === offer.plan_id);
            const endsIn = Math.max(
              0,
              Math.round((new Date(offer.ends_at).getTime() - Date.now()) / 3_600_000),
            );
            return (
              <li key={offer.id} className="flex min-w-0 items-center gap-4 p-4">
                <Tag className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{offer.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {offer.discount_pct}% off {plan?.name ?? "plan"} ·{" "}
                    {endsIn}h left
                    {offer.max_redemptions != null
                      ? ` · ${offer.redemption_count}/${offer.max_redemptions} used`
                      : ` · ${offer.redemption_count} used`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeactivate(offer.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Remove offer"
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
          <div className="grid gap-4 sm:grid-cols-2">
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
              <Label>Discount %</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (hours)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
              >
                <option value="6">6 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Max redemptions (optional)</Label>
              <Input
                type="number"
                min={1}
                placeholder="Unlimited"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Label (shown to fans)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`${discountPct}% off for new subscribers`}
              maxLength={120}
            />
          </div>
          {selectedPlan && (
            <p className="text-sm text-muted-foreground">
              First month:{" "}
              <span className="font-medium text-green-700 dark:text-green-400">
                {formatNgnFromKobo(discountedKobo)}
              </span>{" "}
              (was {formatNgnFromKobo(selectedPlan.price_kobo)}) · renewals at full price
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={loading || !planId}>
              Create offer
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
          <Tag className="h-4 w-4" />
          Add limited-time offer
        </Button>
      )}
    </div>
  );
}
