export default function ContentLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-28 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border px-4 py-3">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-md bg-muted" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
