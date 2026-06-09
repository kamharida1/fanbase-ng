export default function TiersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-5 space-y-3">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
