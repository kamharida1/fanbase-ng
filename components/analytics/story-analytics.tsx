import Image from "next/image";
import { Eye, Clock } from "lucide-react";

import type { StoryAnalyticsRow } from "@/lib/stories/queries";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeRemaining(expires_at: string): string {
  const diff = new Date(expires_at).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 1) return "< 1h left";
  if (hrs < 24) return `${hrs}h left`;
  return `${Math.floor(hrs / 24)}d left`;
}

export function StoryAnalytics({ stories }: { stories: StoryAnalyticsRow[] }) {
  if (!stories.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No stories in the last 7 days. Post a story to see analytics here.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {stories.map((story) => (
        <li key={story.id} className="rounded-xl border bg-card p-4 space-y-3">
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  story.is_active ? "bg-green-500" : "bg-muted-foreground"
                }`}
              />
              <span className="text-muted-foreground">
                {story.is_active
                  ? timeRemaining(story.expires_at)
                  : "Expired"}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {formatRelative(story.created_at)}
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Eye className="h-4 w-4 text-muted-foreground" />
              {story.view_count.toLocaleString()}{" "}
              {story.view_count === 1 ? "view" : "views"}
            </span>
          </div>

          {/* Caption */}
          {story.caption && (
            <p className="text-sm line-clamp-2 text-foreground">
              {story.caption}
            </p>
          )}

          {/* Viewer list */}
          {story.view_count === 0 ? (
            <p className="text-xs text-muted-foreground">No views yet.</p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Viewers (most recent first)
              </p>
              <ul className="divide-y">
                {story.viewers.map((v) => (
                  <li
                    key={v.viewer_id}
                    className="flex items-center gap-3 py-1.5"
                  >
                    {v.avatar_url ? (
                      <Image
                        src={v.avatar_url}
                        alt={v.username}
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase text-muted-foreground">
                        {v.username[0]}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {v.display_name ?? `@${v.username}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{v.username}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelative(v.viewed_at)}
                    </span>
                  </li>
                ))}
              </ul>
              {story.view_count > 50 && (
                <p className="text-xs text-muted-foreground">
                  Showing 50 of {story.view_count} viewers.
                </p>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
