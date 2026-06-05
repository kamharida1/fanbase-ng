import { LiveBadge } from "@/components/live/live-badge";

type LivePlayerProps = {
  embedUrl: string;
  title: string;
  creatorName: string;
};

export function LivePlayer({ embedUrl, title, creatorName }: LivePlayerProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-black">
      <div className="flex items-center gap-3 bg-black px-4 py-2.5">
        <LiveBadge />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          <p className="truncate text-xs text-white/60">{creatorName}</p>
        </div>
      </div>
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={`${embedUrl}?autoplay=true&muted=false`}
          title={`${creatorName} — live stream`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  );
}
