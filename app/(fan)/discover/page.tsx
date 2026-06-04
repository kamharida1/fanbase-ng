import { CreatorCard } from "@/components/creator/creator-card";
import { EmptyState } from "@/components/shared/empty-state";
import { listCreators } from "@/lib/creators/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function DiscoverPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const creators = await listCreators(supabase, {
    limit: 24,
    search: q?.trim() || undefined,
  });

  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-bold">Discover creators</h1>
      <p className="mt-2 text-muted-foreground">
        Find creators to subscribe to.
      </p>

      <form method="GET" className="mt-6 max-w-lg">
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
          {q ? (
            <a
              href="/discover"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border px-4 text-sm font-medium"
            >
              Clear
            </a>
          ) : null}
        </div>
      </form>

      {creators.length === 0 ? (
        <div className="mt-8">
          {q ? (
            <EmptyState
              title={`No results for "${q}"`}
              description="Try a different name or username."
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
          {q && (
            <p className="mt-6 text-sm text-muted-foreground">
              {creators.length} result{creators.length !== 1 ? "s" : ""} for{" "}
              <span className="font-medium">&ldquo;{q}&rdquo;</span>
            </p>
          )}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {creators.map((creator) => (
              <CreatorCard key={creator.user_id} creator={creator} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
