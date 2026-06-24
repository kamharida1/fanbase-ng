"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StoryEditor } from "@/components/feed/story-editor";
import { StoryViewer } from "@/components/feed/story-viewer";
import type { StoryGroup } from "@/lib/stories/queries";

export function StoryStrip({
  groups,
  canAddStory = false,
}: {
  groups: StoryGroup[];
  canAddStory?: boolean;
}) {
  const [active, setActive] = useState<StoryGroup | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  if (!groups.length && !canAddStory) return null;

  return (
    <>
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-4 py-1">
          {canAddStory ? (
            <li className="flex shrink-0 flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-dashed border-muted-foreground/30 transition-opacity hover:opacity-90"
                aria-label="Add to story"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" />
                </span>
              </button>
              <p className="max-w-[64px] truncate text-center text-xs text-muted-foreground">
                Add story
              </p>
            </li>
          ) : null}
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
                      ? "border-primary"
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

      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to story</DialogTitle>
          </DialogHeader>
          <StoryEditor onPublished={() => setComposerOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
