"use client";

import { useEffect, useState } from "react";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";

import {
  getAudienceCount,
  listCreatorBroadcastPlans,
  sendBroadcast,
  type BroadcastPlanOption,
  type BroadcastSegment,
} from "@/lib/broadcast/actions";
import { formatNgnFromKobo } from "@/lib/creators/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TIP_KOBO_PRESETS = [50_000, 100_000, 200_000, 500_000];

const SEGMENT_OPTIONS: { value: BroadcastSegment; label: string }[] = [
  { value: "active", label: "Active subscribers" },
  { value: "new", label: "New subscribers (last 30 days)" },
  { value: "longtime", label: "Long-time subscribers (90+ days)" },
  { value: "lapsing", label: "Lapsing soon (set to cancel)" },
];

type Result = { sentCount: number; totalCount: number } | null;

export function BroadcastComposer({ creatorId }: { creatorId: string }) {
  const [body, setBody] = useState("");
  const [isPpv, setIsPpv] = useState(false);
  const [ppvNgn, setPpvNgn] = useState("");
  const [plans, setPlans] = useState<BroadcastPlanOption[]>([]);
  const [planId, setPlanId] = useState<string>("");
  const [segment, setSegment] = useState<BroadcastSegment>("active");
  const [subCount, setSubCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    listCreatorBroadcastPlans(creatorId).then(setPlans);
  }, [creatorId]);

  const audience = {
    planId: planId || null,
    segment,
  };

  useEffect(() => {
    let cancelled = false;
    setSubCount(null);
    getAudienceCount(creatorId, audience).then((count) => {
      if (!cancelled) setSubCount(count);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId, planId, segment]);

  const ppvKobo = isPpv && ppvNgn ? Math.round(parseFloat(ppvNgn) * 100) : null;

  async function handleSend() {
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await sendBroadcast({
      body,
      isPpv,
      ppvPriceKobo: ppvKobo,
      audience,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error);
      return;
    }

    const sent = res.data?.sentCount ?? 0;
    toast.success(`Broadcast sent to ${sent.toLocaleString()} subscriber${sent !== 1 ? "s" : ""}.`);
    setResult(res.data ?? null);
    setBody("");
    setIsPpv(false);
    setPpvNgn("");
  }

  const canSend =
    body.trim().length > 0 &&
    (!isPpv || (ppvKobo !== null && ppvKobo >= 10_000)) &&
    !loading &&
    (subCount ?? 0) > 0;

  return (
    <div className="space-y-6 rounded-xl border p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Compose broadcast</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {subCount === null
            ? "Loading…"
            : subCount === 0
              ? "No subscribers match"
              : `${subCount.toLocaleString()} recipient${subCount !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Audience */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tier</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            disabled={loading}
          >
            <option value="">All tiers</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatNgnFromKobo(p.price_kobo)})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Segment</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={segment}
            onChange={(e) => setSegment(e.target.value as BroadcastSegment)}
            disabled={loading}
          >
            {SEGMENT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="broadcast-body">Message</Label>
        <Textarea
          id="broadcast-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message to all your subscribers…"
          rows={5}
          maxLength={2000}
          disabled={loading}
        />
        <p className="text-right text-xs text-muted-foreground">
          {body.length}/2000
        </p>
      </div>

      {/* PPV toggle */}
      <div className="space-y-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={isPpv}
            onChange={(e) => { setIsPpv(e.target.checked); setPpvNgn(""); }}
            disabled={loading}
            className="h-4 w-4 rounded border"
          />
          <span className="text-sm font-medium">Pay-to-unlock message</span>
          <span className="text-xs text-muted-foreground">
            Subscribers pay to read the full content
          </span>
        </label>

        {isPpv && (
          <div className="space-y-3 pl-7">
            {/* Preset amounts */}
            <div className="flex flex-wrap gap-2">
              {TIP_KOBO_PRESETS.map((kobo) => {
                const ngn = String(kobo / 100);
                return (
                  <button
                    key={kobo}
                    type="button"
                    onClick={() => setPpvNgn(ngn)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                      ppvNgn === ngn
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:border-primary hover:text-primary"
                    }`}
                  >
                    {formatNgnFromKobo(kobo)}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">₦</span>
              <Input
                type="number"
                min={100}
                step={100}
                placeholder="Custom price (NGN)"
                value={ppvNgn}
                onChange={(e) => setPpvNgn(e.target.value)}
                className="max-w-[180px]"
                disabled={loading}
              />
            </div>
            {ppvNgn && ppvKobo !== null && ppvKobo < 10_000 && (
              <p className="text-xs text-destructive">Minimum PPV price is ₦100.</p>
            )}
          </div>
        )}
      </div>

      {/* Error / result */}
      {error && (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      )}
      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
          ✓ Sent to <strong>{result.sentCount.toLocaleString()}</strong>
          {result.sentCount < result.totalCount
            ? ` of ${result.totalCount.toLocaleString()}`
            : ""}{" "}
          recipient{result.sentCount !== 1 ? "s" : ""}
          {isPpv && ppvKobo
            ? ` — locked at ${formatNgnFromKobo(ppvKobo)}`
            : ""}
          .
        </div>
      )}

      {/* Send button */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          disabled={!canSend}
          onClick={handleSend}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {loading
            ? "Sending…"
            : subCount
              ? `Send to ${subCount.toLocaleString()} recipient${subCount !== 1 ? "s" : ""}`
              : "Send"}
        </Button>
        {subCount === 0 && (
          <p className="text-sm text-muted-foreground">
            No subscribers match this audience.
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Messages land in each recipient&apos;s inbox. Narrow your audience by
        tier or subscriber segment above. The first 500 matching subscribers
        are reached per send.
      </p>
    </div>
  );
}
