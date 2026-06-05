export default function AnalyticsLoading() {
  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <div className="h-7 w-28 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
            <div className="h-7 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="rounded-xl border p-5 space-y-3">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="flex items-end gap-3" style={{ height: 160 }}>
              {Array.from({ length: 6 }).map((_, j) => (
                <div
                  key={j}
                  className="flex-1 animate-pulse rounded-t bg-muted"
                  style={{ height: `${30 + Math.random() * 70}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Table skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="rounded-xl border overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b p-3 last:border-0">
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
              <div className="flex-1 h-4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-12 animate-pulse rounded bg-muted" />
              <div className="h-4 w-12 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
