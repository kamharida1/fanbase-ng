"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Heart, Lock, Pin, PinOff } from "lucide-react";

import { togglePostLike } from "@/lib/posts/actions";
import { pinPost, unpinPost } from "@/lib/posts/moderation";
import { startPpvPurchase } from "@/lib/posts/ppv";
import { formatNgnFromKobo } from "@/lib/creators/format";
import { PollWidget } from "@/components/posts/poll-widget";
import { MediaWatermark } from "@/components/posts/media-watermark";
import { ShareIconButton } from "@/components/shared/share-button";
import { ReportButton } from "@/components/shared/report-button";
import { Button } from "@/components/ui/button";
import type { PostRow } from "@/types/posts";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function MediaGallery({ media }: { media: NonNullable<PostRow["media"]> }) {
  const images = media.filter((m) => m.media_type === "image" && m.url);
  const video = media.find((m) => m.media_type !== "image" && m.url);

  if (video) {
    return (
      <video
        src={video.url!}
        controls
        className="max-h-[480px] w-full rounded-lg"
      />
    );
  }

  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={images[0].url!}
        alt=""
        className="max-h-[480px] w-full rounded-lg object-contain"
      />
    );
  }

  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
        {images.map((m) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.id} src={m.url!} alt="" className="aspect-square w-full object-cover" />
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0].url!} alt="" className="row-span-2 aspect-[1/2] w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[1].url!} alt="" className="aspect-square w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[2].url!} alt="" className="aspect-square w-full object-cover" />
      </div>
    );
  }

  // 4+: 2×2 grid, last cell shows "+N more" if there are extra
  const visible = images.slice(0, 4);
  const overflow = images.length - 4;
  return (
    <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
      {visible.map((m, i) => (
        <div key={m.id} className="relative aspect-square overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.url!} alt="" className="h-full w-full object-cover" />
          {i === 3 && overflow > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <span className="text-2xl font-bold text-white">+{overflow}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

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
  isOwnProfile = false,
  watermarkLabel,
}: {
  post: PostRow;
  showComments?: React.ReactNode;
  isOwnProfile?: boolean;
  watermarkLabel?: string | null;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [pinned, setPinned] = useState(post.is_pinned ?? false);
  const [loading, setLoading] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  const author = post.author;
  const label = author?.display_name ?? author?.username ?? "Creator";
  const locked = !post.can_view_full;
  const isPpv = post.visibility === "ppv";
  const showWarning = Boolean(post.content_warning) && !locked && !warningDismissed;
  const showWatermark =
    Boolean(watermarkLabel) && !isOwnProfile && !locked && post.visibility !== "public";

  async function handlePin() {
    setLoading(true);
    const result = pinned
      ? await unpinPost(post.id)
      : await pinPost(post.id);
    setLoading(false);
    if (result.success) {
      setPinned(!pinned);
      router.refresh();
    }
  }

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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
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
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{author?.username} · {formatWhen(post.published_at)}
            {post.visibility !== "public" ? (
              <> · {post.visibility.replace("_", " ")}</>
            ) : null}
          </p>
        </div>
        {pinned && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <Pin className="h-3 w-3" />
            Pinned
          </span>
        )}
        {isOwnProfile && post.status === "published" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => void handlePin()}
            title={pinned ? "Unpin post" : "Pin to top"}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>
        )}
      </header>

      <div className="relative min-w-0 p-4">
        {showWarning ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">Content warning</p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{post.content_warning}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setWarningDismissed(true)}
              className="border-amber-400 text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-100 dark:hover:bg-amber-900"
            >
              Show anyway
            </Button>
          </div>
        ) : locked ? (
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
              ) : post.author?.username ? (
                <Button size="sm" asChild>
                  <Link href={`/creators/${post.author.username}`}>Subscribe to view</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {post.media && post.media.length > 0 ? (
              <div className="relative">
                <MediaGallery media={post.media} />
                {showWatermark ? <MediaWatermark label={watermarkLabel!} /> : null}
              </div>
            ) : null}
            {post.caption ? (
              <p className="mt-3 break-words whitespace-pre-wrap text-sm">
                {post.caption}
              </p>
            ) : null}
            {post.poll ? <PollWidget poll={post.poll} /> : null}
          </>
        )}
      </div>

      <footer className="flex items-center gap-4 border-t px-4 py-3">
        <button
          type="button"
          disabled={loading || locked}
          aria-label={`${liked ? "Unlike" : "Like"} post — ${likeCount} ${likeCount === 1 ? "like" : "likes"}`}
          onClick={() => void handleLike()}
          className={`inline-flex items-center gap-1.5 text-sm ${
            liked ? "text-red-600" : "text-muted-foreground"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} aria-hidden />
          <span aria-hidden>{likeCount}</span>
        </button>
        <span className="text-sm text-muted-foreground">
          {post.comment_count ?? 0} comments
        </span>
        {!isOwnProfile ? <ReportButton postId={post.id} /> : null}
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
