export default function ReferralsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <div className="h-7 w-36 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-7 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
