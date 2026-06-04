"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelFanSubscription } from "@/lib/subscriptions/actions";
import { formatPlanPrice } from "@/lib/subscriptions/format";
import { isSubscriptionAccessActive } from "@/lib/subscriptions/access";
import { Button } from "@/components/ui/button";
import type { FanSubscriptionRow } from "@/types/subscription";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export function SubscriptionsManager({
  subscriptions,
}: {
  subscriptions: FanSubscriptionRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleCancel(subscriptionId: string) {
    setError(null);
    setLoadingId(subscriptionId);
    const result = await cancelFanSubscription({ subscriptionId });
    setLoadingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (subscriptions.length === 0) {
    return (
      <p className="text-muted-foreground">
        You have no subscriptions yet.{" "}
        <Link href="/creators" className="underline">
          Discover creators
        </Link>
      </p>
    );
  }

  return (
    <ul className="mt-6 divide-y rounded-xl border">
      {subscriptions.map((sub) => {
        const active = isSubscriptionAccessActive(sub);
        const creatorName =
          sub.creator?.display_name ?? sub.creator?.username ?? "Creator";
        const planLabel = sub.plan
          ? `${sub.plan.name} · ${formatPlanPrice(sub.plan.price_kobo, sub.plan.billing_interval)}`
          : "Plan";

        return (
          <li key={sub.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-words font-semibold">
                {creatorName}
                {sub.creator?.username ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    @{sub.creator.username}
                  </span>
                ) : null}
              </p>
              <p className="break-words text-sm text-muted-foreground">
                {planLabel}
              </p>
              <p className="mt-1 text-sm">
                Status:{" "}
                <span className="font-medium capitalize">
                  {sub.cancel_at_period_end && active
                    ? "cancels at period end"
                    : sub.status.replace("_", " ")}
                </span>
              </p>
              {sub.current_period_end ? (
                <p className="text-sm text-muted-foreground">
                  {active ? "Renews / ends" : "Ended"}:{" "}
                  {formatDate(sub.current_period_end)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {sub.creator?.username ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/creators/${sub.creator.username}`}>View profile</Link>
                </Button>
              ) : null}
              {active && !sub.cancel_at_period_end ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loadingId === sub.id}
                  onClick={() => handleCancel(sub.id)}
                >
                  Cancel subscription
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
      {error ? (
        <li className="p-4 text-sm text-destructive" role="alert">
          {error}
        </li>
      ) : null}
    </ul>
  );
}
