import { formatNgnFromKobo } from "@/lib/creators/format";
import { MediaWatermark } from "@/components/posts/media-watermark";
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
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isOwn
            ? "max-w-[min(85%,100%)] break-words rounded-2xl rounded-br-md bg-primary px-4 py-2 text-primary-foreground"
            : "max-w-[min(85%,100%)] break-words rounded-2xl rounded-bl-md border bg-background px-4 py-2"
        }
      >
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
