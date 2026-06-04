import Link from "next/link";

import { formatNgnFromKobo } from "@/lib/creators/format";
import type { PostRow } from "@/types/posts";

function statusLabel(post: PostRow): string {
  if (post.scheduled_publish_at && post.status === "draft") return "Scheduled";
  if (post.status === "draft") return "Draft";
  if (post.status === "published") return "Published";
  return post.status;
}

export function CreatorPostList({ posts }: { posts: PostRow[] }) {
  if (posts.length === 0) {
    return (
      <p className="text-muted-foreground">
        No posts yet. Create your first post to engage fans.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            href={`/creator/content/${post.id}/edit`}
            className="flex flex-col gap-1 p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="line-clamp-1 font-medium">
                {post.caption || `(${post.type} post)`}
              </p>
              <p className="text-sm text-muted-foreground">
                {statusLabel(post)} · {post.visibility}
                {post.ppv_price_kobo
                  ? ` · ${formatNgnFromKobo(post.ppv_price_kobo)}`
                  : ""}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {post.like_count ?? 0} likes · {post.comment_count ?? 0} comments
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
