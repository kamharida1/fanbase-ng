"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type HorizontalNavItem = { href: string; label: string };

export function HorizontalNav({
  items,
  className,
}: {
  items: HorizontalNavItem[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <div
      className={cn(
        "-mx-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:overflow-visible sm:px-0",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <ul className="flex w-max min-w-full gap-4 sm:w-auto sm:flex-wrap">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <li key={item.href} className="shrink-0 sm:shrink">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap text-sm transition-colors",
                  active
                    ? "font-semibold text-foreground underline decoration-2 underline-offset-4"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
