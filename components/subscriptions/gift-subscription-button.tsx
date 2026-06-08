"use client";

import { useState } from "react";
import { Gift } from "lucide-react";

import { sendGiftSubscription } from "@/lib/subscriptions/actions";
import { formatNgnFromKobo } from "@/lib/creators/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const GIFT_MONTH_OPTIONS = [1, 3, 6, 12] as const;

type GiftMonths = (typeof GIFT_MONTH_OPTIONS)[number];

export function GiftSubscriptionButton({
  planId,
  planName,
  priceKobo,
  isLoggedIn,
  loginNext,
  className,
}: {
  planId: string;
  planName: string;
  priceKobo: number;
  isLoggedIn: boolean;
  loginNext: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [recipientUsername, setRecipientUsername] = useState("");
  const [months, setMonths] = useState<GiftMonths>(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <a
        href={`/login?next=${encodeURIComponent(loginNext)}`}
        className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground ${className ?? ""}`}
      >
        <Gift className="h-4 w-4" />
        Gift this plan
      </a>
    );
  }

  async function handleSend() {
    setError(null);
    if (!recipientUsername.trim()) {
      setError("Enter the recipient's username.");
      return;
    }

    setLoading(true);
    const result = await sendGiftSubscription({
      planId,
      recipientUsername: recipientUsername.trim(),
      months,
      message: message.trim() || undefined,
    });
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    if (result.data?.checkoutUrl) {
      window.location.href = result.data.checkoutUrl;
    }
  }

  return (
    <div className={`relative inline-block ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Gift className="h-4 w-4" />
        Gift this plan
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-80 space-y-3 rounded-lg border bg-card p-4 text-sm shadow-lg">
          <div>
            <p className="font-medium">Gift {planName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pay for someone else&apos;s subscription — it activates on their account immediately, no commitment from them.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="gift-recipient">
              Recipient&apos;s username
            </label>
            <Input
              id="gift-recipient"
              value={recipientUsername}
              onChange={(e) => setRecipientUsername(e.target.value)}
              placeholder="e.g. ada_writes"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="gift-months">
              Duration
            </label>
            <select
              id="gift-months"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value) as GiftMonths)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              {GIFT_MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 1 ? "1 month" : `${m} months`} — {formatNgnFromKobo(priceKobo * m)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="gift-message">
              Message (optional)
            </label>
            <Textarea
              id="gift-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note for the recipient…"
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={loading} onClick={() => void handleSend()}>
              {loading ? "Please wait…" : `Gift for ${formatNgnFromKobo(priceKobo * months)}`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={loading}
              onClick={() => { setOpen(false); setError(null); }}
            >
              Cancel
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
