import Link from "next/link";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { RoleBadge } from "@/components/auth/role-badge";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { APP_NAME } from "@/config/constants";
import { getHomeHrefForAuth } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";
import type { AuthContext } from "@/types/auth";

export type NavLink = { href: string; label: string };

type AuthShellProps = {
  auth: AuthContext;
  nav: NavLink[];
  children: React.ReactNode;
  variant?: "default" | "admin";
  bottomNav?: React.ReactNode;
};

export function AuthShell({
  auth,
  nav,
  children,
  variant = "default",
  bottomNav,
}: AuthShellProps) {
  const label =
    auth.profile.display_name ?? auth.profile.username ?? auth.email;

  const rootClass =
    variant === "admin" ? "min-h-screen bg-muted/30" : "min-h-screen";

  const homeHref = getHomeHrefForAuth(auth);

  return (
    <div className={cn(rootClass, "flex overflow-x-clip")}>
      <SidebarNav items={nav} homeHref={homeHref} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:justify-end sm:px-6">
          <Link
            href={homeHref}
            className="shrink-0 text-lg font-bold tracking-tight text-primary sm:hidden"
          >
            {APP_NAME}
          </Link>
          <div className="flex min-w-0 items-center gap-2 text-sm sm:gap-3">
            <NotificationBell userId={auth.userId} />
            <RoleBadge role={auth.appRole} />
            <span className="hidden max-w-xs truncate text-muted-foreground sm:inline">
              {label}
            </span>
            <SignOutButton />
          </div>
        </header>
        <main
          className={cn(
            "mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8",
            bottomNav && "pb-24 sm:pb-8",
          )}
        >
          {children}
        </main>
      </div>
      {bottomNav}
    </div>
  );
}

export const FAN_NAV: NavLink[] = [
  { href: "/feed", label: "Feed" },
  { href: "/discover", label: "Discover" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
  { href: "/referrals", label: "Refer & earn" },
  { href: "/settings", label: "Settings" },
];

/** Browse-first links shared by fans and creators, then creator studio tools. */
export const CREATOR_NAV: NavLink[] = [
  { href: "/feed", label: "Feed" },
  { href: "/discover", label: "Discover" },
  { href: "/creator/dashboard", label: "Dashboard" },
  { href: "/creator/content", label: "Content" },
  { href: "/creator/content/new", label: "New post" },
  { href: "/creator/profile", label: "Profile" },
  { href: "/creator/live", label: "Go Live" },
  { href: "/creator/broadcast", label: "Broadcast" },
  { href: "/creator/fans", label: "Fans" },
  { href: "/creator/vault", label: "Vault" },
  { href: "/creator/tiers", label: "Tiers" },
  { href: "/creator/analytics", label: "Analytics" },
  { href: "/creator/earnings", label: "Earnings" },
  { href: "/creator/withdrawals", label: "Withdrawals" },
  { href: "/creator/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
  { href: "/referrals", label: "Refer & earn" },
  { href: "/settings", label: "Settings" },
];

export function getShellNavForRole(
  role: AuthContext["appRole"],
  profileRole: AuthContext["profile"]["role"] = "fan",
): NavLink[] {
  return profileRole === "creator" ? CREATOR_NAV : FAN_NAV;
}
