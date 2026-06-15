import type { AppRole } from "@/types/auth";
import type { UserRole } from "@/types/index";

/** Numeric rank — higher includes all lower permissions. */
export const ROLE_RANK: Record<AppRole, number> = {
  user: 0,
  creator: 1,
  moderator: 2,
  admin: 3,
  super_admin: 4,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  user: "User",
  creator: "Creator",
  moderator: "Moderator",
  admin: "Admin",
  super_admin: "Super Admin",
};

export function hasMinimumRole(
  current: AppRole,
  required: AppRole,
): boolean {
  return ROLE_RANK[current] >= ROLE_RANK[required];
}

export function mapProfileRoleToAppRole(role: UserRole): AppRole {
  switch (role) {
    case "fan":
      return "user";
    case "creator":
      return "creator";
    case "moderator":
      return "moderator";
    case "admin":
      return "admin";
    default:
      return "user";
  }
}

/** Staff slug from admin_roles takes precedence over profiles.role. */
export function resolveAppRole(
  profileRole: UserRole,
  adminRoleSlug: string | null,
): AppRole {
  if (adminRoleSlug === "super_admin") return "super_admin";
  if (adminRoleSlug === "admin") return "admin";
  if (adminRoleSlug === "moderator") return "moderator";

  return mapProfileRoleToAppRole(profileRole);
}

export function getDefaultPathForRole(role: AppRole): string {
  switch (role) {
    case "super_admin":
    case "admin":
    case "moderator":
      return "/feed";
    case "creator":
      return "/feed";
    default:
      return "/feed";
  }
}

export function isStaffRole(role: AppRole): boolean {
  return role === "moderator" || role === "admin" || role === "super_admin";
}

export const ROUTE_MIN_ROLE = {
  fan: "user" as AppRole,
  creator: "creator" as AppRole,
  admin: "moderator" as AppRole,
} as const;
