import { HorizontalNav } from "@/components/layout/horizontal-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { RoleBadge } from "@/components/auth/role-badge";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";
import type { AuthContext } from "@/types/auth";

type NavLink = { href: string; label: string };

type AuthShellProps = {
  auth: AuthContext;
  nav: NavLink[];
  children: React.ReactNode;
  variant?: "default" | "admin";
};

export function AuthShell({
  auth,
  nav,
  children,
  variant = "default",
}: AuthShellProps) {
  const label =
    auth.profile.display_name ?? auth.profile.username ?? auth.email;

  const headerClass =
    variant === "admin"
      ? "border-b bg-background px-6 py-4"
      : "border-b px-6 py-4";

  const rootClass =
    variant === "admin" ? "min-h-screen bg-muted/30" : "min-h-screen";

  return (
    <div className={cn(rootClass, "overflow-x-clip")}>
      <header className={headerClass}>
        <nav className="mx-auto flex max-w-6xl min-w-0 flex-col gap-4 px-4 sm:px-6">
          <HorizontalNav items={nav} />
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm sm:gap-3">
            <NotificationBell userId={auth.userId} />
            <RoleBadge role={auth.appRole} />
            <span className="max-w-[10rem] truncate text-muted-foreground sm:max-w-xs">
              {label}
            </span>
            <SignOutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

export const FAN_NAV: NavLink[] = [
  { href: "/feed", label: "Feed" },
  { href: "/discover", label: "Discover" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" },
];

export const CREATOR_NAV: NavLink[] = [
  { href: "/creator/dashboard", label: "Dashboard" },
  { href: "/creator/live", label: "🔴 Go Live" },
  { href: "/creator/broadcast", label: "Broadcast" },
  { href: "/creator/fans", label: "Fans" },
  { href: "/creator/profile", label: "Profile" },
  { href: "/creator/content", label: "Content" },
  { href: "/creator/tiers", label: "Tiers" },
  { href: "/creator/earnings", label: "Earnings" },
  { href: "/creator/withdrawals", label: "Withdrawals" },
  { href: "/creator/messages", label: "Messages" },
  { href: "/notifications", label: "Notifications" },
];
