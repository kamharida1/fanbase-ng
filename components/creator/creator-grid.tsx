"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CreatorCard } from "@/components/creator/creator-card";
import type { CreatorListItem } from "@/types/creator";

type CreatorsApiResponse = {
  data?: { creators: CreatorListItem[]; nextCursor: string | null; hasMore: boolean };
  error?: string;
};

export function CreatorGrid({
  initialCreators,
  initialCursor,
  initialHasMore,
  search,
  category,
}: {
  initialCreators: CreatorListItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
  search?: string;
  category?: string;
}) {
  const [creators, setCreators] = useState(initialCreators);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Reset pagination state whenever the filter inputs change (new search/category).
  useEffect(() => {
    setCreators(initialCreators);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
    setError(null);
  }, [initialCreators, initialCursor, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !cursor || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ cursor });
      if (search) params.set("q", search);
      if (category) params.set("cat", category);
      const res = await fetch(`/api/v1/creators?${params.toString()}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as CreatorsApiResponse;

      if (!res.ok || !json.data) {
        throw new Error(json.error ?? "Could not load more creators.");
      }

      setCreators((prev) => {
        const seen = new Set(prev.map((c) => c.user_id));
        const merged = [...prev];
        for (const creator of json.data!.creators) {
          if (!seen.has(creator.user_id)) merged.push(creator);
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
  }, [cursor, hasMore, search, category]);

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

  return (
    <>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {creators.map((creator) => (
          <CreatorCard key={creator.user_id} creator={creator} />
        ))}
      </div>

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

      {!hasMore && creators.length > 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          You&apos;ve seen all creators.
        </p>
      ) : null}
    </>
  );
}
