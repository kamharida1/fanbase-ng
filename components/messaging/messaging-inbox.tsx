"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ConversationList } from "@/components/messaging/conversation-list";
import { MessageThread } from "@/components/messaging/message-thread";
import {
  subscribeToInbox,
  unsubscribeChannel,
} from "@/lib/messaging/realtime";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ConversationRow, MessageRow } from "@/types/messaging";

export function MessagingInbox({
  initialInbox,
  initialRequests,
  initialMessages,
  selectedConversation,
  currentUserId,
  role,
  requestCount,
}: {
  initialInbox: ConversationRow[];
  initialRequests: ConversationRow[];
  initialMessages: MessageRow[];
  selectedConversation: ConversationRow | null;
  currentUserId: string;
  role: "fan" | "creator";
  requestCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("c");
  const [tab, setTab] = useState<"inbox" | "requests">(
    searchParams.get("tab") === "requests" ? "requests" : "inbox",
  );
  const [inbox, setInbox] = useState(initialInbox);
  const [requests, setRequests] = useState(initialRequests);

  const supabase = createClient();

  const refreshInbox = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    setInbox(initialInbox);
    setRequests(initialRequests);
  }, [initialInbox, initialRequests]);

  useEffect(() => {
    const channel = subscribeToInbox(supabase, currentUserId, role, refreshInbox);
    return () => unsubscribeChannel(supabase, channel);
  }, [currentUserId, role, refreshInbox, supabase]);

  function selectConversation(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("c", id);
    if (tab === "requests") params.set("tab", "requests");
    router.push(`?${params.toString()}`);
  }

  function clearConversation() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("c");
    router.push(`?${params.toString()}`);
  }

  const list = tab === "requests" ? requests : inbox;
  const showThread = Boolean(selectedId && selectedConversation);

  return (
    <div
      className={cn(
        "grid min-h-[min(70dvh,560px)] overflow-hidden rounded-xl border",
        "h-[calc(100dvh-11rem)] max-h-[720px] md:h-[calc(100vh-12rem)] md:max-h-none",
        "md:grid-cols-[minmax(0,320px)_1fr]",
      )}
    >
      <aside
        className={cn(
          "flex min-h-0 min-w-0 flex-col border-b md:border-b-0 md:border-r",
          showThread ? "hidden md:flex" : "flex",
        )}
      >
        {role === "creator" ? (
          <div className="flex shrink-0 border-b">
            <button
              type="button"
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                tab === "inbox" ? "border-b-2 border-primary" : "text-muted-foreground"
              }`}
              onClick={() => {
                setTab("inbox");
                const params = new URLSearchParams(searchParams.toString());
                params.delete("tab");
                router.push(`?${params.toString()}`);
              }}
            >
              Inbox
            </button>
            <button
              type="button"
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                tab === "requests"
                  ? "border-b-2 border-primary"
                  : "text-muted-foreground"
              }`}
              onClick={() => {
                setTab("requests");
                const params = new URLSearchParams(searchParams.toString());
                params.set("tab", "requests");
                router.push(`?${params.toString()}`);
              }}
            >
              Requests
              {requestCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                  {requestCount}
                </span>
              ) : null}
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-b px-4 py-3">
            <p className="text-sm font-semibold">Messages</p>
          </div>
        )}

        <ConversationList
          conversations={list}
          selectedId={selectedId}
          onSelect={selectConversation}
        />
      </aside>

      <section
        className={cn(
          "flex min-h-0 min-w-0 flex-col bg-muted/20",
          showThread ? "flex" : "hidden md:flex",
        )}
      >
        {showThread ? (
          <>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 border-b px-4 py-2.5 text-sm font-medium md:hidden"
              onClick={clearConversation}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Conversations
            </button>
            <MessageThread
              conversation={selectedConversation!}
              initialMessages={initialMessages}
              currentUserId={currentUserId}
              role={role}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
            <p>Select a conversation to start messaging.</p>
          </div>
        )}
      </section>
    </div>
  );
}
