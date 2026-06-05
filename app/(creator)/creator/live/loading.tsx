export default function LiveLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="rounded-xl border p-6 space-y-4">
        <div className="h-5 w-36 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
