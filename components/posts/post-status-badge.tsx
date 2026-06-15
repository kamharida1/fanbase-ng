import { cn } from "@/lib/utils";
import type { PostRow } from "@/types/posts";

type BadgeTone = "neutral" | "success" | "warning" | "muted";

function toneForPost(post: PostRow): BadgeTone {
  if (post.scheduled_publish_at && post.status === "draft") return "warning";
  if (post.status === "draft") return "muted";
  if (post.status === "archived") return "muted";
  if (post.moderation_status === "pending") return "warning";
  if (post.moderation_status === "rejected") return "neutral";
  return "success";
}

function labelForPost(post: PostRow): string {
  if (post.scheduled_publish_at && post.status === "draft") return "Scheduled";
  if (post.status === "draft") return "Draft";
  if (post.status === "archived") return "Archived";
  if (post.moderation_status === "pending") return "Under review";
  if (post.moderation_status === "rejected") return "Rejected";
  if (post.status === "published") return "Live";
  return post.status;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  muted: "border-border bg-muted/60 text-muted-foreground",
};

export function PostStatusBadge({
  post,
  className,
}: {
  post: PostRow;
  className?: string;
}) {
  const tone = toneForPost(post);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {labelForPost(post)}
    </span>
  );
}

export function VisibilityBadge({
  visibility,
  className,
}: {
  visibility: PostRow["visibility"];
  className?: string;
}) {
  const labels: Record<PostRow["visibility"], string> = {
    public: "Public",
    subscribers: "Subscribers",
    tier: "Tier",
    ppv: "PPV",
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {labels[visibility]}
    </span>
  );
}
