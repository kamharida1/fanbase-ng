"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, Radio } from "lucide-react";

import {
  endLiveStream,
  markStreamLive,
  pollLiveStreamStatus,
  startLiveStream,
} from "@/lib/live/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveBadge } from "@/components/live/live-badge";

type StreamState =
  | { phase: "idle" }
  | {
      phase: "ready";
      streamId: string;
      rtmpsUrl: string;
      streamKey: string;
      embedUrl: string;
      cloudflareUid: string;
    }
  | { phase: "live"; streamId: string; embedUrl: string };

type Props = {
  existing?: {
    streamId: string;
    status: "idle" | "live";
    rtmpsUrl: string | null;
    streamKey: string | null;
    embedUrl: string | null;
    cloudflareUid: string | null;
  } | null;
};

export function GoLivePanel({ existing }: Props) {
  const [state, setState] = useState<StreamState>(() => {
    if (!existing) return { phase: "idle" };
    if (existing.status === "live" && existing.embedUrl) {
      return { phase: "live", streamId: existing.streamId, embedUrl: existing.embedUrl };
    }
    if (
      existing.status === "idle" &&
      existing.rtmpsUrl &&
      existing.streamKey &&
      existing.embedUrl &&
      existing.cloudflareUid
    ) {
      return {
        phase: "ready",
        streamId: existing.streamId,
        rtmpsUrl: existing.rtmpsUrl,
        streamKey: existing.streamKey,
        embedUrl: existing.embedUrl,
        cloudflareUid: existing.cloudflareUid,
      };
    }
    return { phase: "idle" };
  });

  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll for OBS connection while in "ready" phase
  useEffect(() => {
    if (state.phase !== "ready") {
      stopPolling();
      return;
    }

    const { streamId, cloudflareUid } = state;

    pollRef.current = setInterval(async () => {
      const { connected } = await pollLiveStreamStatus(cloudflareUid);
      if (connected) {
        stopPolling();
        await markStreamLive(streamId);
        setState((s) =>
          s.phase === "ready"
            ? { phase: "live", streamId: s.streamId, embedUrl: s.embedUrl }
            : s,
        );
      }
    }, 5000);

    return stopPolling;
  }, [state, stopPolling]);

  function copy(value: string, label: string) {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function handleStart() {
    setError(null);
    setLoading(true);
    const result = await startLiveStream(title);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const d = result.data!;
    setState({
      phase: "ready",
      streamId: d.streamId,
      rtmpsUrl: d.rtmpsUrl,
      streamKey: d.streamKey,
      embedUrl: d.embedUrl,
      cloudflareUid: d.cloudflareUid,
    });
  }

  async function handleEnd() {
    if (state.phase === "idle") return;
    setLoading(true);
    await endLiveStream(state.streamId);
    setLoading(false);
    setState({ phase: "idle" });
    setTitle("");
  }

  // ── Phase: idle ───────────────────────────────────────────────────────────
  if (state.phase === "idle") {
    return (
      <div className="space-y-6 rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <Radio className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold">Start a live stream</h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stream-title">Stream title</Label>
          <Input
            id="stream-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q&A with fans, Behind the scenes…"
            maxLength={120}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}

        <Button onClick={handleStart} disabled={loading} className="w-full sm:w-auto">
          {loading ? "Setting up…" : "Create stream"}
        </Button>
      </div>
    );
  }

  // ── Phase: ready (waiting for OBS) ───────────────────────────────────────
  if (state.phase === "ready") {
    return (
      <div className="space-y-6 rounded-xl border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-amber-500 animate-pulse" />
            <h2 className="text-lg font-semibold">Waiting for you to go live…</h2>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEnd}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Open OBS (or any RTMP streaming app) and paste the server URL and
          stream key below, then click <strong>Start Streaming</strong>. This
          page will update automatically when you go live.
        </p>

        {/* RTMP Server */}
        <div className="space-y-2">
          <Label>RTMP server</Label>
          <div className="flex gap-2">
            <Input readOnly value={state.rtmpsUrl} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copy(state.rtmpsUrl, "server")}
              aria-label="Copy server URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {copied === "server" && (
            <p className="text-xs text-muted-foreground">Copied!</p>
          )}
        </div>

        {/* Stream key */}
        <div className="space-y-2">
          <Label>Stream key</Label>
          <div className="flex gap-2">
            <Input
              readOnly
              type={keyVisible ? "text" : "password"}
              value={state.streamKey}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setKeyVisible((v) => !v)}
              aria-label={keyVisible ? "Hide stream key" : "Show stream key"}
            >
              {keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copy(state.streamKey, "key")}
              aria-label="Copy stream key"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {copied === "key" && (
            <p className="text-xs text-muted-foreground">Copied!</p>
          )}
          <p className="text-xs text-muted-foreground">
            Keep this secret — anyone with it can stream to your channel.
          </p>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 text-sm">
          <p className="font-medium mb-2">OBS quick setup</p>
          <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
            <li>Open OBS → <strong>Settings → Stream</strong></li>
            <li>Service: <strong>Custom…</strong></li>
            <li>Paste Server URL and Stream Key above</li>
            <li>Click <strong>OK → Start Streaming</strong></li>
          </ol>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Waiting for stream connection… this page will update automatically.
          </p>
        </div>
      </div>
    );
  }

  // ── Phase: live ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 rounded-xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LiveBadge />
          <h2 className="text-lg font-semibold">You&apos;re live!</h2>
        </div>
        <Button
          variant="destructive"
          onClick={handleEnd}
          disabled={loading}
        >
          End stream
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Your subscribers have been notified. Here&apos;s how your stream looks
        to viewers:
      </p>

      <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={`${state.embedUrl}?autoplay=true`}
          title="Your live stream preview"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  );
}
