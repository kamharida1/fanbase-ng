"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type VerifyState =
  | { phase: "idle" }
  | { phase: "verifying" }
  | { phase: "success" }
  | { phase: "pending"; message: string }
  | { phase: "failed"; reason: string }
  | { phase: "error"; message: string };

export function VerifyCheckout({
  reference,
  successRedirect = "/subscriptions?subscribed=1",
}: {
  reference: string | null;
  successRedirect?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<VerifyState>({ phase: "idle" });

  useEffect(() => {
    if (!reference) return;

    let cancelled = false;

    async function verify() {
      setState({ phase: "verifying" });

      try {
        const res = await fetch("/api/v1/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });

        const json = (await res.json()) as {
          data?: {
            status: string;
            kind?: "subscription" | "ppv" | "message_ppv";
            subscriptionId?: string;
            postId?: string;
            messageId?: string;
            reason?: string;
            message?: string;
          };
          error?: string;
        };

        if (cancelled) return;

        if (!res.ok) {
          setState({
            phase: "error",
            message: json.error ?? "Verification request failed.",
          });
          return;
        }

        const result = json.data;
        if (!result) {
          setState({ phase: "error", message: "Empty verification response." });
          return;
        }

        if (result.status === "success") {
          setState({ phase: "success" });
          router.replace(successRedirect);
          router.refresh();
          return;
        }

        if (result.status === "failed") {
          setState({
            phase: "failed",
            reason: result.reason ?? "Payment failed.",
          });
          return;
        }

        if (result.status === "pending") {
          setState({
            phase: "pending",
            message: result.message ?? "Payment is still processing.",
          });
          return;
        }

        setState({
          phase: "pending",
          message: "Confirming payment with Paystack…",
        });
      } catch {
        if (!cancelled) {
          setState({
            phase: "error",
            message: "Could not reach the server. Refresh in a moment.",
          });
        }
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [reference, router]);

  if (!reference) return null;

  if (state.phase === "verifying" || state.phase === "idle") {
    return (
      <p className="mt-4 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
        Verifying your payment…
      </p>
    );
  }

  if (state.phase === "pending") {
    return (
      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {state.message} If you were charged, access will unlock once Paystack
        confirms (usually under a minute).
      </p>
    );
  }

  if (state.phase === "failed") {
    return (
      <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {state.reason}
      </p>
    );
  }

  if (state.phase === "error") {
    return (
      <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {state.message}
      </p>
    );
  }

  return null;
}
