import { AlertTriangle } from "lucide-react";

export function MediaStorageNotice() {
  return (
    <div
      className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
      <div className="space-y-1">
        <p className="font-medium">Photo and video uploads are unavailable</p>
        <p className="text-amber-900/80 dark:text-amber-100/80">
          Media storage is not configured for this environment. Text posts still
          work, but image and video uploads will fail until R2 or Cloudflare
          Stream is set up.
        </p>
      </div>
    </div>
  );
}
