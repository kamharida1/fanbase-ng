import Link from "next/link";

import { CreatorCard } from "@/components/creator/creator-card";
import { PostCard } from "@/components/posts/post-card";
import { SuggestedCreators } from "@/components/recommendations/suggested-creators";
import { EmptyState } from "@/components/shared/empty-state";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { CREATOR_CATEGORIES } from "@/lib/creators/categories";
import { buildWatermarkLabel } from "@/lib/media/watermark";
import { listCreators } from "@/lib/creators/queries";
import {
  listTrendingHashtags,
  listTrendingPosts,
  searchPosts,
} from "@/lib/posts/queries";
import { getRecommendedCreators } from "@/lib/recommendations/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ q?: string; cat?: string; mode?: string; tag?: string }>;
};

export default async function DiscoverPage({ searchParams }: PageProps) {
  const { q, cat, mode: rawMode, tag } = await searchParams;
  const mode = rawMode === "posts" ? "posts" : "creators";
  const supabase = await createClient();

  if (mode === "posts") {
    const auth = await getAuthContext(supabase);
    const viewerId = auth?.userId ?? null;
    const watermarkLabel = auth
      ? buildWatermarkLabel({ username: auth.profile.username, userId: auth.userId })
      : null;

    const trimmedQuery = q?.trim();
    const activeTag = tag?.trim().replace(/^#/, "").toLowerCase() || undefined;
    const isSearching = Boolean(trimmedQuery || activeTag);

    const [trendingHashtags, posts] = await Promise.all([
      listTrendingHashtags(supabase, 12),
      isSearching
        ? searchPosts(supabase, {
            query: trimmedQuery,
            hashtag: activeTag,
            viewerId,
            limit: 24,
          })
        : listTrendingPosts(supabase, viewerId, 24),
    ]);

    function buildPostsHref(overrides: { q?: string | null; tag?: string | null }) {
      const params = new URLSearchParams();
      params.set("mode", "posts");
      const newQ = "q" in overrides ? overrides.q : q;
      const newTag = "tag" in overrides ? overrides.tag : tag;
      if (newQ?.trim()) params.set("q", newQ.trim());
      if (newTag) params.set("tag", newTag);
      return `/discover?${params.toString()}`;
    }

    return (
      <div className="min-w-0">
        <h1 className="text-2xl font-bold">Discover</h1>
        <p className="mt-2 text-muted-foreground">
          Search posts and explore what&apos;s trending.
        </p>

        <DiscoverTabs mode={mode} />

        <form method="GET" className="mt-6 max-w-lg">
          <input type="hidden" name="mode" value="posts" />
          {activeTag ? <input type="hidden" name="tag" value={activeTag} /> : null}
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search posts by caption…"
              className="min-w-0 flex-1 basis-[12rem] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Search
            </button>
            {isSearching ? (
              <Link
                href="/discover?mode=posts"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border px-4 text-sm font-medium"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        {trendingHashtags.length > 0 ? (
          <div className="-mx-4 mt-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max min-w-full gap-2 pb-1 sm:flex-wrap sm:w-auto">
              {trendingHashtags.map((entry) => (
                <Link
                  key={entry.hashtag}
                  href={buildPostsHref({
                    q: null,
                    tag: activeTag === entry.hashtag ? null : entry.hashtag,
                  })}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTag === entry.hashtag
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary hover:text-primary"
                  }`}
                >
                  #{entry.hashtag}
                  <span className="text-xs text-muted-foreground">
                    {entry.post_count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <h2 className="text-lg font-semibold">
            {isSearching
              ? `Results${trimmedQuery ? ` for "${trimmedQuery}"` : ""}${activeTag ? ` #${activeTag}` : ""}`
              : "Trending now"}
          </h2>

          {posts.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title={isSearching ? "No posts found" : "Nothing trending yet"}
                description={
                  isSearching
                    ? "Try a different search term or hashtag."
                    : "Check back soon as creators publish new posts."
                }
              />
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} watermarkLabel={watermarkLabel} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const auth = await getAuthContext(supabase);
  const viewerId = auth?.userId ?? null;

  const isFiltering = Boolean(q?.trim() || cat);

  const [creators, suggestedCreators] = await Promise.all([
    listCreators(supabase, {
      limit: 24,
      search: q?.trim() || undefined,
      category: cat || undefined,
    }),
    viewerId && !isFiltering
      ? getRecommendedCreators(supabase, viewerId, 8)
      : Promise.resolve([]),
  ]);

  const activeCategory = CREATOR_CATEGORIES.find((c) => c.value === cat);

  function buildHref(overrides: { q?: string; cat?: string | null }) {
    const params = new URLSearchParams();
    const newQ = "q" in overrides ? overrides.q : q;
    const newCat = "cat" in overrides ? overrides.cat : cat;
    if (newQ?.trim()) params.set("q", newQ.trim());
    if (newCat) params.set("cat", newCat);
    const qs = params.toString();
    return `/discover${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-bold">Discover creators</h1>
      <p className="mt-2 text-muted-foreground">
        Find Nigerian creators to subscribe to.
      </p>

      <DiscoverTabs mode={mode} />

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <form method="GET" className="mt-6 max-w-lg">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or username…"
            className="min-w-0 flex-1 basis-[12rem] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Search
          </button>
          {(q || cat) ? (
            <Link
              href="/discover"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border px-4 text-sm font-medium"
            >
              Clear all
            </Link>
          ) : null}
        </div>
      </form>

      {/* ── Category chips ─────────────────────────────────────────── */}
      <div className="-mx-4 mt-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full gap-2 pb-1 sm:flex-wrap sm:w-auto">
          <Link
            href={buildHref({ cat: null })}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              !cat
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:border-primary hover:text-primary"
            }`}
          >
            All creators
          </Link>
          {CREATOR_CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={buildHref({ cat: c.value })}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                cat === c.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:border-primary hover:text-primary"
              }`}
            >
              <span aria-hidden>{c.emoji}</span>
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Suggested creators ─────────────────────────────────────── */}
      {suggestedCreators.length > 0 ? (
        <div className="mt-8">
          <SuggestedCreators creators={suggestedCreators} />
        </div>
      ) : null}

      {/* ── Results ────────────────────────────────────────────────── */}
      {creators.length === 0 ? (
        <div className="mt-8">
          {q || cat ? (
            <EmptyState
              title={
                q && cat
                  ? `No ${activeCategory?.label ?? cat} creators matching "${q}"`
                  : q
                    ? `No results for "${q}"`
                    : `No creators in ${activeCategory?.label ?? cat} yet`
              }
              description="Try a different search or category."
              action={
                <Link href="/discover" className="text-sm underline">
                  View all creators
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="No creators yet"
              description="Check back soon — creators are joining every day."
            />
          )}
        </div>
      ) : (
        <>
          {suggestedCreators.length > 0 ? (
            <h2 className="mt-8 text-lg font-semibold">All creators</h2>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
            {creators.length} creator{creators.length !== 1 ? "s" : ""}
            {activeCategory ? ` in ${activeCategory.label}` : ""}
            {q ? ` matching "${q}"` : ""}
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {creators.map((creator) => (
              <CreatorCard key={creator.user_id} creator={creator} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DiscoverTabs({ mode }: { mode: "creators" | "posts" }) {
  return (
    <div className="mt-4 inline-flex rounded-lg border p-1">
      <Link
        href="/discover"
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          mode === "creators"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Creators
      </Link>
      <Link
        href="/discover?mode=posts"
        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
          mode === "posts"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Posts
      </Link>
    </div>
  );
}
