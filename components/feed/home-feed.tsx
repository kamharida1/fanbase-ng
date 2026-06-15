"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { FeedPostItem } from "@/components/feed/feed-post-item";
import type { FeedPage } from "@/types/feed";
import type { PostRow } from "@/types/posts";

type FeedApiResponse = {
  data?: FeedPage;
  error?: string;
};

export function HomeFeed({
  initialPosts,
  initialCursor,
  initialHasMore,
  viewerId,
  watermarkLabel,
  hideEmptyState = false,
}: {
  initialPosts: PostRow[];
  initialCursor: string | null;
  initialHasMore: boolean;
  viewerId?: string | null;
  watermarkLabel?: string | null;
  hideEmptyState?: boolean;
}) {
  const [posts, setPosts] = useState<PostRow[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!hasMore || !cursor || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ cursor });
      const res = await fetch(`/api/v1/feed?${params.toString()}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as FeedApiResponse;

      if (!res.ok || !json.data) {
        throw new Error(json.error ?? "Could not load more posts.");
      }

      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const post of json.data!.posts) {
          if (!seen.has(post.id)) merged.push(post);
        }
        return merged;
      });
      setCursor(json.data.nextCursor);
      setHasMore(json.data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [cursor, hasMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (posts.length === 0 && !hideEmptyState) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <p className="text-lg font-semibold">Your feed is quiet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Subscribe to creators or publish your own posts to fill this space.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/discover"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Discover creators
          </Link>
          <Link
            href="/creator/content/new"
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Create a post
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <FeedPostItem key={post.id} post={post} viewerId={viewerId} watermarkLabel={watermarkLabel} />
      ))}

      <div ref={sentinelRef} className="h-4" aria-hidden />

      {loading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Loading more…
        </p>
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => void loadMore()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!hasMore && posts.length > 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          You&apos;re all caught up.
        </p>
      ) : null}
    </div>
  );
}
