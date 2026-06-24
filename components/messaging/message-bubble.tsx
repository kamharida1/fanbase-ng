"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

import { formatNgnFromKobo } from "@/lib/creators/format";
import { startMessagePpvPurchase } from "@/lib/messaging/ppv";
import { MediaWatermark } from "@/components/posts/media-watermark";
import { Button } from "@/components/ui/button";
import type { MessageRow } from "@/types/messaging";

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function MessageBubble({
  message,
  isOwn,
  watermarkLabel,
}: {
  message: MessageRow;
  isOwn: boolean;
  watermarkLabel?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = !isOwn && message.is_ppv && !message.unlocked;

  async function handleUnlock() {
    setLoading(true);
    setError(null);
    const result = await startMessagePpvPurchase(message.id, message.created_at);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    window.location.href = result.authorizationUrl;
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isOwn
            ? "max-w-[min(85%,100%)] break-words rounded-2xl rounded-br-md bg-primary px-4 py-2 text-primary-foreground"
            : "max-w-[min(85%,100%)] break-words rounded-2xl rounded-bl-md border bg-background px-4 py-2"
        }
      >
        {locked ? (
          <div className="flex min-w-[160px] flex-col items-center gap-2 py-2 text-center">
            <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">
              {message.attachment_type
                ? `Locked ${message.attachment_type}`
                : "Locked message"}
            </p>
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : null}
            <Button size="sm" disabled={loading} onClick={() => void handleUnlock()}>
              {loading
                ? "Loading…"
                : `Unlock for ${formatNgnFromKobo(message.ppv_price_kobo ?? 0)}`}
            </Button>
          </div>
        ) : (
          <>
            {message.attachment_url && message.attachment_type === "image" ? (
              <div className="relative mb-2 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.attachment_url}
                  alt={message.attachment_filename ?? "Attachment"}
                  className="w-full max-h-64 rounded-lg object-cover"
                />
                {!isOwn && watermarkLabel ? (
                  <MediaWatermark label={watermarkLabel} />
                ) : null}
              </div>
            ) : null}

            {message.attachment_url && message.attachment_type !== "image" ? (
              <a
                href={message.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-2 block text-sm underline"
              >
                {message.attachment_filename ?? "Download attachment"}
              </a>
            ) : null}

            {message.body ? (
              <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
            ) : null}

            {message.is_ppv && message.ppv_price_kobo ? (
              <p className="mt-1 text-xs opacity-80">
                PPV · {formatNgnFromKobo(message.ppv_price_kobo)}
              </p>
            ) : null}
          </>
        )}

        <div
          className={`mt-1 flex items-center gap-2 text-[10px] ${
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          <span>{formatTime(message.created_at)}</span>
          {isOwn && message.read_by_other ? <span>Read</span> : null}
        </div>
      </div>
    </div>
  );
}
