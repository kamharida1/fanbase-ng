"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { subscribeToPlan } from "@/lib/subscriptions/actions";
import { Button } from "@/components/ui/button";
import type { CreatorPageSubscriptionState } from "@/lib/subscriptions/queries";

export function SubscribeButton({
  planId,
  planName,
  isFree,
  subscriptionState,
  isLoggedIn,
  loginNext,
  offerId,
  bundleId,
  label,
}: {
  planId: string;
  planName: string;
  isFree: boolean;
  subscriptionState: CreatorPageSubscriptionState;
  isLoggedIn: boolean;
  loginNext: string;
  offerId?: string;
  bundleId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (
    subscriptionState.kind === "active" &&
    subscriptionState.planId === planId
  ) {
    return (
      <Button className="mt-4 w-full" variant="secondary" disabled>
        {subscriptionState.cancelAtPeriodEnd
          ? "Subscribed — ends at period close"
          : "Subscribed"}
      </Button>
    );
  }

  if (subscriptionState.kind === "active") {
    return (
      <Button className="mt-4 w-full" variant="outline" disabled>
        Subscribed on another plan
      </Button>
    );
  }

  if (!isLoggedIn) {
    return (
      <Button className="mt-4 w-full" asChild>
        <a href={`/login?next=${encodeURIComponent(loginNext)}`}>Sign in to subscribe</a>
      </Button>
    );
  }

  async function handleSubscribe() {
    setError(null);
    setLoading(true);

    const result = await subscribeToPlan({ planId, offerId, bundleId });
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    if (result.data?.checkoutUrl) {
      window.location.href = result.data.checkoutUrl;
      return;
    }

    router.refresh();
    router.push("/subscriptions?subscribed=1");
  }

  return (
    <div className="mt-4">
      <Button
        className="w-full"
        onClick={handleSubscribe}
        disabled={loading}
      >
        {loading
          ? "Please wait…"
          : label
            ? label
            : isFree
              ? `Join ${planName} (free)`
              : `Subscribe to ${planName}`}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error.includes("pending checkout session")
            ? "You already started checkout for this creator. Complete that payment or wait up to 24 hours before trying again."
            : error}
        </p>
      ) : null}
    </div>
  );
}
