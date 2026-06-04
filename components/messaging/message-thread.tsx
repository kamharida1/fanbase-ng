"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { MessageBubble } from "@/components/messaging/message-bubble";
import { MessageComposer } from "@/components/messaging/message-composer";
import { RequestActions } from "@/components/messaging/request-actions";
import { markConversationRead } from "@/lib/messaging/actions";
import { getSignedAttachmentUrl } from "@/lib/messaging/storage";
import {
  subscribeToConversationMessages,
  unsubscribeChannel,
} from "@/lib/messaging/realtime";
import { createClient } from "@/lib/supabase/client";
import type { ConversationRow, MessageRow } from "@/types/messaging";

export function MessageThread({
  conversation,
  initialMessages,
  currentUserId,
  role,
}: {
  conversation: ConversationRow;
  initialMessages: MessageRow[];
  currentUserId: string;
  role: "fan" | "creator";
}) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState(initialMessages);
  const supabase = createClient();

  const otherId =
    role === "fan" ? conversation.creator_id : conversation.fan_id;

  const enrichMessage = useCallback(
    async (row: MessageRow): Promise<MessageRow> => {
      if (!row.media_r2_key) return row;
      const url = await getSignedAttachmentUrl(supabase, row.media_r2_key);
      return { ...row, attachment_url: url };
    },
    [supabase],
  );

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    void markConversationRead({ conversationId: conversation.id });
  }, [conversation.id]);

  useEffect(() => {
    const channel = subscribeToConversationMessages(
      supabase,
      conversation.id,
      {
        onInsert: (row) => {
          void enrichMessage(row as MessageRow).then((enriched) => {
            setMessages((prev) => {
              if (prev.some((m) => m.id === enriched.id)) return prev;
              return [...prev, enriched];
            });
          });
          if (row.sender_id !== currentUserId) {
            void markConversationRead({ conversationId: conversation.id });
          }
          router.refresh();
        },
        onRead: () => {
          router.refresh();
        },
      },
    );

    return () => {
      unsubscribeChannel(supabase, channel);
    };
  }, [
    conversation.id,
    currentUserId,
    enrichMessage,
    router,
    supabase,
  ]);

  const other = conversation.other_participant;
  const title = other?.display_name ?? other?.username ?? "Chat";

  const composerHint =
    conversation.status === "pending" && role === "fan"
      ? "You can send one intro message while your request is pending."
      : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b px-4 py-3">
        <p className="truncate font-semibold">{title}</p>
        {other?.username ? (
          <p className="truncate text-sm text-muted-foreground">
            @{other.username}
          </p>
        ) : null}
      </div>

      {role === "creator" && conversation.status === "pending" ? (
        <RequestActions conversationId={conversation.id} />
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4">
        {messages.map((message) => (
          <MessageBubble
            key={`${message.id}-${message.created_at}`}
            message={message}
            isOwn={message.sender_id === currentUserId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <MessageComposer
        conversationId={conversation.id}
        status={conversation.status}
        hint={composerHint}
        disabled={conversation.status === "declined"}
      />
    </div>
  );
}
