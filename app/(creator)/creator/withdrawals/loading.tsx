export default function WithdrawalsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="h-7 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-lg border p-5 space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="space-y-1">
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
