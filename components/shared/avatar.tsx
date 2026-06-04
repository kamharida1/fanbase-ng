import Image from "next/image";

import { cn } from "@/lib/utils";

type AvatarProps = {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
};

export function Avatar({ src, alt, size = 40, className }: AvatarProps) {
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
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-cover"
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
