import Link from "next/link";

import { cn } from "@/lib/utils";

export type HorizontalNavItem = { href: string; label: string };

/**
 * Scrollable primary nav on small screens; wraps on sm+.
 */
export function HorizontalNav({
  items,
  className,
}: {
  items: HorizontalNavItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:overflow-visible sm:px-0",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <ul className="flex w-max min-w-full gap-4 sm:w-auto sm:flex-wrap">
        {items.map((item) => (
          <li key={item.href} className="shrink-0 sm:shrink">
            <Link
              href={item.href}
              className="block whitespace-nowrap text-sm hover:underline"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
