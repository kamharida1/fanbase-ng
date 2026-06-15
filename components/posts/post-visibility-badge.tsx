import { Lock } from "lucide-react";

import { getPostVisibilityMeta } from "@/lib/posts/visibility";
import { cn } from "@/lib/utils";
import type { PostVisibility } from "@/types/posts";

export function PostVisibilityBadge({
  visibility,
  locked = false,
  className,
}: {
  visibility: PostVisibility;
  locked?: boolean;
  className?: string;
}) {
  if (visibility === "public" && !locked) return null;

  const meta = getPostVisibilityMeta(visibility);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        meta.tone === "accent"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {locked ? <Lock className="h-3 w-3" aria-hidden /> : null}
      {meta.shortLabel}
    </span>
  );
}
