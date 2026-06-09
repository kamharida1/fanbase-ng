export default function SubscriptionsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="h-7 w-36 animate-pulse rounded bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="space-y-1.5">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
