"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart } from "lucide-react";

import { startTip, TIP_PRESETS_KOBO, MIN_TIP_KOBO } from "@/lib/tips/actions";
import { formatNgnFromKobo } from "@/lib/creators/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  creatorId: string;
  creatorUsername: string;
  isLoggedIn: boolean;
};

export function TipButton({ creatorId, creatorUsername, isLoggedIn }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginHref = `/login?next=${encodeURIComponent(`/creators/${creatorUsername}`)}`;

  const amountKobo: number | null = selected
    ? selected
    : custom.trim()
      ? Math.round(parseFloat(custom) * 100)
      : null;

  async function handleSend() {
    if (!amountKobo || amountKobo < MIN_TIP_KOBO) {
      setError(`Minimum tip is ${formatNgnFromKobo(MIN_TIP_KOBO)}.`);
      return;
    }
    setError(null);
    setLoading(true);
    const result = await startTip({ creatorId, creatorUsername, amountKobo });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    window.location.href = result.authorizationUrl;
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={() => {
          if (!isLoggedIn) {
            window.location.href = loginHref;
            return;
          }
          setOpen(true);
        }}
      >
        <Heart className="h-4 w-4 text-red-500" />
        Send tip
      </Button>
    );
  }

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Send a tip</p>
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => { setOpen(false); setSelected(null); setCustom(""); setError(null); }}
        >
          Cancel
        </button>
      </div>

      {/* Preset amounts */}
      <div className="flex flex-wrap gap-2">
        {TIP_PRESETS_KOBO.map((kobo) => (
          <button
            key={kobo}
            type="button"
            onClick={() => { setSelected(kobo); setCustom(""); }}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              selected === kobo
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:border-primary hover:text-primary"
            }`}
          >
            {formatNgnFromKobo(kobo)}
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">₦</span>
        <Input
          type="number"
          min={100}
          step={100}
          placeholder="Custom amount"
          value={custom}
          onChange={(e) => { setCustom(e.target.value); setSelected(null); }}
          className="max-w-[180px]"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={loading || !amountKobo}
          onClick={handleSend}
          className="gap-2"
        >
          <Heart className="h-4 w-4" />
          {loading
            ? "Opening payment…"
            : amountKobo
              ? `Pay ${formatNgnFromKobo(amountKobo)}`
              : "Select an amount"}
        </Button>
        {!isLoggedIn && (
          <Link href={loginHref} className="text-sm text-muted-foreground underline">
            Sign in first
          </Link>
        )}
      </div>
    </div>
  );
}
