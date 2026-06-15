import { CREATOR_NAV, FAN_NAV } from "@/components/auth/auth-shell";
import { getAdminNavForRole } from "@/lib/auth/admin-nav";
import { isStaffRole } from "@/lib/auth/rbac";
import type { AuthContext } from "@/types/auth";

export type NavLink = { href: string; label: string };

export function dedupeNavLinks(items: NavLink[]): NavLink[] {
  const seen = new Set<string>();
  const out: NavLink[] = [];
  for (const item of items) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    out.push(item);
  }
  return out;
}

/** Fan or creator app nav from the profile role (not staff appRole). */
export function getMemberNav(
  auth: AuthContext,
  options?: { preferCreatorNav?: boolean },
): NavLink[] {
  if (options?.preferCreatorNav || auth.profile.role === "creator") {
    return CREATOR_NAV;
  }
  return FAN_NAV;
}

/**
 * Staff keep super-admin permissions but also get the full member app nav
 * (feed, messages, subscriptions, creator studio, etc.).
 */
export function getNavForAuth(
  auth: AuthContext,
  options?: { preferCreatorNav?: boolean },
): NavLink[] {
  const memberNav = getMemberNav(auth, options);

  if (!isStaffRole(auth.appRole)) {
    return memberNav;
  }

  const adminNav = getAdminNavForRole(auth.appRole).map(({ href, label }) => ({
    href,
    label,
  }));

  return dedupeNavLinks([...memberNav, ...adminNav]);
}

export function usesCreatorBottomNav(auth: AuthContext): boolean {
  return auth.profile.role === "creator";
}

export function getHomeHrefForAuth(auth: AuthContext): string {
  return "/feed";
}
