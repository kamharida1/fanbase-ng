"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Banknote,
  Bell,
  Circle,
  Compass,
  Gift,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  MessageSquare,
  PlusCircle,
  Radio,
  Settings,
  Star,
  Tag,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { APP_NAME } from "@/config/constants";
import type { NavLink } from "@/components/auth/auth-shell";

const ICON_BY_HREF: Record<string, LucideIcon> = {
  "/feed": Home,
  "/discover": Compass,
  "/subscriptions": Star,
  "/messages": MessageSquare,
  "/notifications": Bell,
  "/referrals": Gift,
  "/settings": Settings,
  "/creator/dashboard": LayoutDashboard,
  "/creator/content": ImageIcon,
  "/creator/content/new": PlusCircle,
  "/creator/profile": User,
  "/creator/live": Radio,
  "/creator/broadcast": Radio,
  "/creator/fans": Users,
  "/creator/vault": Lock,
  "/creator/tiers": Tag,
  "/creator/analytics": BarChart3,
  "/creator/earnings": Banknote,
  "/creator/withdrawals": Banknote,
  "/creator/messages": MessageSquare,
};

function iconFor(href: string): LucideIcon {
  return ICON_BY_HREF[href] ?? Circle;
}

export function SidebarNav({
  items,
  homeHref,
}: {
  items: NavLink[];
  homeHref: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col border-r border-border bg-card/60 py-6 sm:flex lg:w-64"
      aria-label="Primary navigation"
    >
      <Link
        href={homeHref}
        className="mb-6 flex items-center justify-center px-2 text-lg font-bold tracking-tight text-primary lg:justify-start lg:px-6"
      >
        <span className="hidden lg:inline">{APP_NAME}</span>
        <span className="lg:hidden">
          {APP_NAME.slice(0, 1)}
        </span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-2 lg:px-3">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = iconFor(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    "justify-center lg:justify-start",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                  title={item.label}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden truncate lg:inline">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
