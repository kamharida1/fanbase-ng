"use client";

import { useEffect, useRef, useState } from "react";

import { sendLiveChatMessage, type LiveChatMessageRow } from "@/lib/live/chat";
import { subscribeToLiveChat, unsubscribeChannel } from "@/lib/live/chat-realtime";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LiveChatPanel({
  streamId,
  initialMessages,
  viewerId,
}: {
  streamId: string;
  initialMessages: LiveChatMessageRow[];
  viewerId: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [profileCache, setProfileCache] = useState<
    Map<string, { username: string; display_name: string | null }>
  >(
    new Map(
      initialMessages
        .filter((m) => m.sender)
        .map((m) => [m.sender_id, m.sender!]),
    ),
  );
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = subscribeToLiveChat(supabase, streamId, (message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
      if (!profileCache.has(message.sender_id)) {
        void supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", message.sender_id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setProfileCache((prev) => new Map(prev).set(message.sender_id, data));
            }
          });
      }
    });

    return () => {
      unsubscribeChannel(supabase, channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    setSending(true);
    setError(null);
    const result = await sendLiveChatMessage({ streamId, body: text });
    setSending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    setBody("");
  }

  return (
    <div className="flex h-full flex-col rounded-xl border bg-card">
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No messages yet. Say hi!
          </p>
        ) : (
          messages.map((m) => {
            const profile = m.sender ?? profileCache.get(m.sender_id);
            const label = profile?.display_name ?? profile?.username ?? "Viewer";
            const isOwn = m.sender_id === viewerId;
            return (
              <div key={m.id} className="text-sm">
                <span className={isOwn ? "font-semibold text-primary" : "font-semibold"}>
                  {label}
                </span>
                <span className="ml-1.5 break-words text-foreground/90">{m.body}</span>
              </div>
            );
          })
        )}
      </div>

      {error ? (
        <p className="px-3 text-xs text-destructive" role="alert">{error}</p>
      ) : null}

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t p-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Say something…"
          maxLength={500}
          disabled={sending}
        />
        <Button type="submit" size="sm" disabled={sending || !body.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
