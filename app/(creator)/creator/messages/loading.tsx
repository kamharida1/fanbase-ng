export default function CreatorMessagesLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="h-7 w-32 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border px-4 py-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
              <div className="h-3 w-48 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-3 w-10 shrink-0 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
