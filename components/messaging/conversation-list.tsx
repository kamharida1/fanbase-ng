"use client";

import type { ConversationRow } from "@/types/messaging";

function formatPreviewTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric" }).format(
    d,
  );
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (conversations.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
    );
  }

  return (
    <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
      {conversations.map((conv) => {
        const other = conv.other_participant;
        const label = other?.display_name ?? other?.username ?? "User";
        const initial = label.charAt(0).toUpperCase();
        const selected = conv.id === selectedId;

        return (
          <li key={conv.id}>
            <button
              type="button"
              onClick={() => onSelect(conv.id)}
              className={`flex w-full gap-3 p-4 text-left transition-colors hover:bg-muted/50 ${
                selected ? "bg-muted" : ""
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                {other?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={other.avatar_url}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatPreviewTime(conv.last_message_at)}
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {conv.status === "pending" ? "Request · " : ""}
                  {conv.last_message_preview ?? "No messages yet"}
                </p>
              </div>
              {(conv.unread_count ?? 0) > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {conv.unread_count}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
