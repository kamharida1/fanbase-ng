"use client";

import { useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PostEditor } from "@/components/posts/post-editor";
import type { CategoryRow } from "@/lib/vault/queries";

type PlanOption = { id: string; name: string };

export function FeedComposer({
  avatarUrl,
  displayName,
  plans,
  categories,
  mediaStorageConfigured,
}: {
  avatarUrl: string | null;
  displayName: string;
  plans: PlanOption[];
  categories: CategoryRow[];
  mediaStorageConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          What&apos;s on your mind?
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
          <PostEditor
            plans={plans}
            categories={categories}
            mediaStorageConfigured={mediaStorageConfigured}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
