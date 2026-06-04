export default function DiscoverLoading() {
  return (
    <div>
      <div className="h-7 w-44 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-10 w-full max-w-sm animate-pulse rounded-md bg-muted" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="space-y-1.5">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
