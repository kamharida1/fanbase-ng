import Link from "next/link";

import { CreatorCard } from "@/components/creator/creator-card";
import { EmptyState } from "@/components/shared/empty-state";
import { CREATOR_CATEGORIES } from "@/lib/creators/categories";
import { listCreators } from "@/lib/creators/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ q?: string; cat?: string }>;
};

export default async function DiscoverPage({ searchParams }: PageProps) {
  const { q, cat } = await searchParams;
  const supabase = await createClient();

  const creators = await listCreators(supabase, {
    limit: 24,
    search: q?.trim() || undefined,
    category: cat || undefined,
  });

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
          <p className="mt-6 text-sm text-muted-foreground">
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
