import { BadgeCheck } from "lucide-react";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ${className ?? ""}`}
      title="Verified creator"
    >
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      Verified
    </span>
  );
}
