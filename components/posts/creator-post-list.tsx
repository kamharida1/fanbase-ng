import Link from "next/link";
import { Film, ImageIcon, MessageSquareText, Video } from "lucide-react";

import {
  PostStatusBadge,
  VisibilityBadge,
} from "@/components/posts/post-status-badge";
import { formatNgnFromKobo } from "@/lib/creators/format";
import type { PostRow } from "@/types/posts";

function typeIcon(type: PostRow["type"]) {
  switch (type) {
    case "image":
      return ImageIcon;
    case "video":
      return Video;
    default:
      return MessageSquareText;
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Not published";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function PostThumbnail({ post }: { post: PostRow }) {
  const previewUrl = post.media?.find((m) => m.url)?.url;

  if (previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt=""
        className="h-full w-full object-cover"
      />
    );
  }

  const Icon = typeIcon(post.type);
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Icon className="h-6 w-6 text-muted-foreground" />
    </div>
  );
}

export function CreatorPostList({
  posts,
  publicProfileHref,
}: {
  posts: PostRow[];
  publicProfileHref?: string | null;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Film className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No posts yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Create your first post to show up on your feed and public profile.
        </p>
        <Link
          href="/creator/content/new"
          className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Create post
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {publicProfileHref ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
          <p className="text-muted-foreground">
            Published posts appear on your public profile and feed.
          </p>
          <Link href={publicProfileHref} className="font-medium underline underline-offset-4">
            View public profile
          </Link>
        </div>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/creator/content/${post.id}/edit`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden border-b bg-muted">
                <PostThumbnail post={post} />
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  <PostStatusBadge post={post} />
                  <VisibilityBadge visibility={post.visibility} />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="line-clamp-2 font-medium leading-snug">
                    {post.caption || `${post.type.charAt(0).toUpperCase()}${post.type.slice(1)} post`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(post.published_at ?? post.created_at)}
                    {post.ppv_price_kobo
                      ? ` · ${formatNgnFromKobo(post.ppv_price_kobo)}`
                      : ""}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {post.like_count ?? 0} likes · {post.comment_count ?? 0} comments
                  </span>
                  <span className="font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Edit
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
