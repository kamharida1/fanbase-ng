import { Heart, MessageCircle } from "lucide-react";

import { formatNgnFromKobo } from "@/lib/creators/format";
import type { TopPost } from "@/lib/analytics/queries";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  subscribers: "Subscribers",
  tier: "Tier",
  ppv: "PPV",
};

const TYPE_LABELS: Record<string, string> = {
  text: "Text",
  image: "Photo",
  video: "Video",
};

export function TopPostsTable({ posts }: { posts: TopPost[] }) {
  if (!posts.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No published posts yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[540px] text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="p-3 font-medium">#</th>
            <th className="p-3 font-medium">Post</th>
            <th className="p-3 font-medium">Type</th>
            <th className="p-3 font-medium text-right">
              <Heart className="inline h-3.5 w-3.5 text-red-500" />
            </th>
            <th className="p-3 font-medium text-right">
              <MessageCircle className="inline h-3.5 w-3.5 text-blue-500" />
            </th>
            <th className="p-3 font-medium">Published</th>
            <th className="p-3 font-medium">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post, i) => (
            <tr key={post.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-3 text-muted-foreground">{i + 1}</td>
              <td className="p-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="line-clamp-1 font-medium">
                    {post.caption || `(${TYPE_LABELS[post.type] ?? post.type} post)`}
                  </p>
                  <span className="text-xs text-muted-foreground capitalize">
                    {VISIBILITY_LABELS[post.visibility] ?? post.visibility}
                    {post.ppv_price_kobo
                      ? ` · ${formatNgnFromKobo(post.ppv_price_kobo)}`
                      : ""}
                  </span>
                </div>
              </td>
              <td className="p-3 text-muted-foreground capitalize">
                {TYPE_LABELS[post.type] ?? post.type}
              </td>
              <td className="p-3 text-right tabular-nums">{post.like_count}</td>
              <td className="p-3 text-right tabular-nums">{post.comment_count}</td>
              <td className="p-3 text-muted-foreground whitespace-nowrap">
                {formatDate(post.published_at)}
              </td>
              <td className="p-3 text-muted-foreground">
                {post.ppv_price_kobo
                  ? formatNgnFromKobo(post.ppv_price_kobo)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
