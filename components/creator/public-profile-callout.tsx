import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function PublicProfileCallout({
  username,
  compact = false,
}: {
  username: string;
  compact?: boolean;
}) {
  const href = `/creators/${username}`;

  if (compact) {
    return (
      <p className="text-sm text-muted-foreground">
        Posts appear on your{" "}
        <Link
          href={href}
          className="font-medium text-foreground underline underline-offset-4"
        >
          public profile
        </Link>
        , not on this settings page.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="font-medium">Fans see your posts on your public profile</p>
          <p className="text-sm text-muted-foreground">
            This page is for editing bio, photos, and settings. Published posts
            show up at{" "}
            <span className="font-medium text-foreground">@{username}</span>.
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          View public profile
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
