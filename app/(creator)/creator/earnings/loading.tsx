export default function EarningsLoading() {
  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
            <div className="h-7 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="overflow-hidden rounded-lg border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b px-4 py-3 last:border-0"
            >
              <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-3.5 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
