"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, Lock } from "lucide-react";

import { togglePostLike } from "@/lib/posts/actions";
import { startPpvPurchase } from "@/lib/posts/ppv";
import { formatNgnFromKobo } from "@/lib/creators/format";
import { ShareIconButton } from "@/components/shared/share-button";
import { Button } from "@/components/ui/button";
import type { PostRow } from "@/types/posts";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function PostCard({
  post,
  showComments,
}: {
  post: PostRow;
  showComments?: React.ReactNode;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [loading, setLoading] = useState(false);

  const author = post.author;
  const label = author?.display_name ?? author?.username ?? "Creator";
  const locked = !post.can_view_full;
  const isPpv = post.visibility === "ppv";

  async function handleLike() {
    setLoading(true);
    const result = await togglePostLike({ postId: post.id });
    setLoading(false);
    if (result.success && result.data) {
      setLiked(result.data.liked);
      setLikeCount((c) => (result.data!.liked ? c + 1 : Math.max(0, c - 1)));
    }
  }

  async function handleUnlock() {
    setLoading(true);
    const result = await startPpvPurchase(post.id);
    setLoading(false);
    if (result.success) {
      window.location.href = result.authorizationUrl;
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <header className="flex min-w-0 items-center gap-3 border-b px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
          {author?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={author.avatar_url}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            label.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{author?.username} · {formatWhen(post.published_at)}
            {post.visibility !== "public" ? (
              <> · {post.visibility.replace("_", " ")}</>
            ) : null}
          </p>
        </div>
      </header>

      <div className="relative min-w-0 p-4">
        {locked ? (
          <div className="relative overflow-hidden rounded-lg bg-muted">
            {post.media?.[0]?.url && post.media[0].media_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.media[0].url}
                alt=""
                className="max-h-80 w-full object-cover blur-xl scale-110 opacity-60"
              />
            ) : (
              <div className="flex h-48 items-center justify-center">
                <Lock className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 p-4 text-center">
              <Lock className="h-8 w-8" />
              <p className="font-medium">
                {isPpv && post.ppv_price_kobo
                  ? `Unlock for ${formatNgnFromKobo(post.ppv_price_kobo)}`
                  : "Subscribers only"}
              </p>
              {isPpv && post.ppv_price_kobo ? (
                <Button size="sm" disabled={loading} onClick={() => void handleUnlock()}>
                  Unlock post
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {post.media && post.media.length > 0 ? (
              <div className="space-y-2">
                {post.media.map((m) =>
                  m.media_type === "image" && m.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={m.id}
                      src={m.url}
                      alt=""
                      className="max-h-[480px] w-full rounded-lg object-contain"
                    />
                  ) : m.url ? (
                    <video
                      key={m.id}
                      src={m.url}
                      controls
                      className="max-h-[480px] w-full rounded-lg"
                    />
                  ) : null,
                )}
              </div>
            ) : null}
            {post.caption ? (
              <p className="mt-3 break-words whitespace-pre-wrap text-sm">
                {post.caption}
              </p>
            ) : null}
          </>
        )}
      </div>

      <footer className="flex items-center gap-4 border-t px-4 py-3">
        <button
          type="button"
          disabled={loading || locked}
          onClick={() => void handleLike()}
          className={`inline-flex items-center gap-1.5 text-sm ${
            liked ? "text-red-600" : "text-muted-foreground"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          {likeCount}
        </button>
        <span className="text-sm text-muted-foreground">
          {post.comment_count ?? 0} comments
        </span>
        {post.visibility === "public" && post.author?.username ? (
          <div className="ml-auto">
            <ShareIconButton
              url={`${APP_URL}/creators/${post.author.username}`}
              title={post.caption?.slice(0, 80) ?? "Check out this post on Fanbase NG"}
              text={`${post.author.display_name ?? post.author.username} on Fanbase NG`}
            />
          </div>
        ) : null}
      </footer>

      {!locked && showComments ? (
        <div className="border-t px-4 py-3">{showComments}</div>
      ) : null}
    </article>
  );
}
