"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deactivateSubscriptionPlan,
  upsertSubscriptionPlan,
} from "@/lib/creators/actions";
import { formatPlanPrice } from "@/lib/subscriptions/format";
import { koboToNgn } from "@/lib/creators/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PlanBillingInterval } from "@/types/subscription";

export type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  price_kobo: number;
  billing_interval: PlanBillingInterval;
  trial_days: number;
  sort_order: number;
  is_active: boolean;
};

export function PlansManager({ plans }: { plans: PlanRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [billingInterval, setBillingInterval] =
    useState<PlanBillingInterval>("monthly");
  const [priceNgn, setPriceNgn] = useState("");
  const [trialDays, setTrialDays] = useState("0");
  const [sortOrder, setSortOrder] = useState("0");

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setBillingInterval("monthly");
    setPriceNgn("");
    setTrialDays("0");
    setSortOrder("0");
  }

  function startEdit(plan: PlanRow) {
    setEditingId(plan.id);
    setName(plan.name);
    setDescription(plan.description ?? "");
    setBillingInterval(plan.billing_interval);
    setPriceNgn(
      plan.billing_interval === "free"
        ? "0"
        : String(koboToNgn(plan.price_kobo)),
    );
    setTrialDays(String(plan.trial_days));
    setSortOrder(String(plan.sort_order));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await upsertSubscriptionPlan(
      {
        name,
        description,
        billing_interval: billingInterval,
        price_ngn:
          billingInterval === "free" ? 0 : parseFloat(priceNgn) || 0,
        trial_days: billingInterval === "free" ? 0 : parseInt(trialDays, 10) || 0,
        sort_order: parseInt(sortOrder, 10) || 0,
        is_active: true,
      },
      editingId ?? undefined,
    );

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    resetForm();
    router.refresh();
  }

  async function handleDeactivate(planId: string) {
    setLoading(true);
    const result = await deactivateSubscriptionPlan(planId);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const activePlans = plans.filter((p) => p.is_active);
  const isFree = billingInterval === "free";

  return (
    <div className="grid min-w-0 gap-10 lg:grid-cols-2">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {editingId ? "Edit plan" : "New plan"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="planName">Name</Label>
            <Input
              id="planName"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gold"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planDesc">Description</Label>
            <Textarea
              id="planDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billingInterval">Billing</Label>
            <select
              id="billingInterval"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={billingInterval}
              onChange={(e) => {
                const v = e.target.value as PlanBillingInterval;
                setBillingInterval(v);
                if (v === "free") setPriceNgn("0");
              }}
            >
              <option value="monthly">Monthly (Paystack)</option>
              <option value="annual">Annual (Paystack)</option>
              <option value="free">Free</option>
            </select>
          </div>
          {!isFree ? (
            <div className="space-y-2">
              <Label htmlFor="planPrice">Price (NGN)</Label>
              <Input
                id="planPrice"
                type="number"
                min={1}
                step={100}
                required
                value={priceNgn}
                onChange={(e) => setPriceNgn(e.target.value)}
              />
            </div>
          ) : null}
          {!isFree ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trialDays">Trial days</Label>
                <Input
                  id="trialDays"
                  type="number"
                  min={0}
                  max={90}
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sort order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input
                id="sortOrder"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          )}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {editingId ? "Update plan" : "Create plan"}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        <p className="text-xs text-muted-foreground">
          Paid plans sync to Paystack when keys are configured. Fans checkout via
          Paystack; free plans activate instantly.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your plans</h2>
        {activePlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active plans yet. Create one to appear on your profile.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {activePlans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPlanPrice(plan.price_kobo, plan.billing_interval)}
                    {plan.trial_days > 0
                      ? ` · ${plan.trial_days}d trial`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(plan)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeactivate(plan.id)}
                    disabled={loading}
                  >
                    Deactivate
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
