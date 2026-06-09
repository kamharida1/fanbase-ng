"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  Bell,
  Compass,
  DollarSign,
  Film,
  Home,
  LayoutDashboard,
  MessageSquare,
  Star,
} from "lucide-react";

import { cn } from "@/lib/utils";

type BottomNavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const FAN_ITEMS: BottomNavItem[] = [
  { href: "/feed", label: "Home", Icon: Home },
  { href: "/discover", label: "Discover", Icon: Compass },
  { href: "/subscriptions", label: "Following", Icon: Star },
  { href: "/messages", label: "Messages", Icon: MessageSquare },
  { href: "/notifications", label: "Alerts", Icon: Bell },
];

const CREATOR_ITEMS: BottomNavItem[] = [
  { href: "/creator/dashboard", label: "Home", Icon: LayoutDashboard },
  { href: "/creator/content", label: "Content", Icon: Film },
  { href: "/creator/analytics", label: "Stats", Icon: BarChart2 },
  { href: "/creator/messages", label: "Messages", Icon: MessageSquare },
  { href: "/creator/earnings", label: "Earnings", Icon: DollarSign },
];

function BottomNav({ items }: { items: BottomNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-16 items-center justify-around">
        {items.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== "/" && pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function FanBottomNav() {
  return <BottomNav items={FAN_ITEMS} />;
}

export function CreatorBottomNav() {
  return <BottomNav items={CREATOR_ITEMS} />;
}
