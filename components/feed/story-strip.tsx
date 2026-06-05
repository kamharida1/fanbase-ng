"use client";

import { useState } from "react";

import { StoryViewer } from "@/components/feed/story-viewer";
import type { StoryGroup } from "@/lib/stories/queries";

export function StoryStrip({ groups }: { groups: StoryGroup[] }) {
  const [active, setActive] = useState<StoryGroup | null>(null);

  if (!groups.length) return null;

  return (
    <>
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-4 py-1">
          {groups.map((g) => {
            const label = g.creator.display_name ?? g.creator.username;
            const initial = label.charAt(0).toUpperCase();
            return (
              <li key={g.creator.id} className="flex shrink-0 flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActive(g)}
                  className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] transition-opacity hover:opacity-90 ${
                    g.hasUnviewed
                      ? "border-red-500"
                      : "border-muted-foreground/30"
                  }`}
                  aria-label={`View ${label}'s story`}
                >
                  {g.creator.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.creator.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold">{initial}</span>
                  )}
                </button>
                <p className="max-w-[64px] truncate text-center text-xs text-muted-foreground">
                  {label}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      {active && (
        <StoryViewer group={active} onClose={() => setActive(null)} />
      )}
    </>
  );
}
