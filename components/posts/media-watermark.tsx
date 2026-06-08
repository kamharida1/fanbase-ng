const TILE_COUNT = 24;

/**
 * Forensic deterrent overlay: tiles the viewer's handle/ID fragment across
 * gated media so leaked screenshots/recordings can be traced back to them.
 * Not a hard technical block (CSS can be stripped) — the goal is visible
 * traceability that discourages casual redistribution.
 */
export function MediaWatermark({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none overflow-hidden">
      <div className="absolute -inset-1/4 flex flex-wrap content-around justify-around gap-x-10 gap-y-8 [transform:rotate(-22deg)]">
        {Array.from({ length: TILE_COUNT }).map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-white/35 [text-shadow:0_1px_3px_rgba(0,0,0,0.55)] sm:text-xs"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
