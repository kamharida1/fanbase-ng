import { cn } from "@/lib/utils";
import { normalizeMediaUrl } from "@/lib/media/delivery-url";

type AvatarProps = {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
};

export function Avatar({ src, alt, size = 40, className }: AvatarProps) {
  const normalizedSrc = normalizeMediaUrl(src);
  const initials = alt
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-muted",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {normalizedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={normalizedSrc}
          alt={alt}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground"
          aria-hidden
        >
          {initials || "?"}
        </span>
      )}
    </div>
  );
}
