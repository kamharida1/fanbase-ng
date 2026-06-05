import { cn } from "@/lib/utils";

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
      Live
    </span>
  );
}
