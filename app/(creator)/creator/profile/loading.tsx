export default function CreatorProfileLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <div className="h-7 w-36 animate-pulse rounded bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          </div>
        ))}
        <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}
