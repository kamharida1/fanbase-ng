"use client";

import { useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";

import { uploadFileWithPresign } from "@/lib/media/client-upload";
import { sendMessage } from "@/lib/messaging/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConversationStatus } from "@/types/messaging";

export function MessageComposer({
  conversationId,
  status,
  disabled,
  hint,
  hideRequestLimits = false,
}: {
  conversationId: string;
  status: ConversationStatus;
  disabled?: boolean;
  hint?: string;
  hideRequestLimits?: boolean;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isDeclined = status === "declined";
  const isDisabled = disabled || isDeclined || loading;

  async function handleSend() {
    setError(null);
    setLoading(true);

    const file = fileRef.current?.files?.[0];
    let result;

    if (file) {
      try {
        const uploaded = await uploadFileWithPresign({
          context: "message",
          contextRefId: conversationId,
          file,
        });
        if (uploaded.status !== "ready") {
          setError(
            "Attachment is still processing. Try again in a few seconds.",
          );
          setLoading(false);
          return;
        }
        result = await sendMessage({
          conversationId,
          body,
          mediaUploadId: uploaded.uploadId,
        });
        if (fileRef.current) fileRef.current.value = "";
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "Upload failed.");
        return;
      }
    } else {
      result = await sendMessage({ conversationId, body });
    }

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setBody("");
  }

  return (
    <div className="border-t bg-background p-4">
      {hint ? (
        <p className="mb-2 text-xs text-muted-foreground">{hint}</p>
      ) : null}
      {status === "pending" && !hideRequestLimits ? (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
          Message request — limited messages until accepted.
        </p>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex min-w-0 items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,video/mp4,video/webm,audio/mpeg,application/pdf"
          onChange={() => setError(null)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={isDisabled}
          onClick={() => fileRef.current?.click()}
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={isDeclined ? "Conversation closed" : "Write a message…"}
          disabled={isDisabled}
          rows={2}
          className="min-h-[44px] min-w-0 flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!isDisabled && (body.trim() || fileRef.current?.files?.[0])) {
                void handleSend();
              }
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          disabled={isDisabled || (!body.trim() && !fileRef.current?.files?.[0])}
          onClick={() => void handleSend()}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
