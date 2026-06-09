export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-1">
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
