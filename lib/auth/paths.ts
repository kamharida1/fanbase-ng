import type { AppRole } from "@/types/auth";
import { hasMinimumRole } from "@/lib/auth/rbac";

/** Routes accessible without authentication. */
export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/verify",
  "/forgot-password",
  "/reset-password",
  "/callback",
  "/creators",
  "/legal",
  "/api/health",
  "/api/ready",
  "/api/v1/webhooks",
] as const;

/** Auth pages — redirect to app if already signed in. */
export const AUTH_PATHS = [
  "/login",
  "/signup",
  "/verify",
  "/forgot-password",
] as const;

/**
 * Minimum role by route prefix (longest match wins).
 * Order does not matter — sorted by prefix length at runtime.
 */
export const PROTECTED_ROUTE_PREFIXES: {
  prefix: string;
  minRole: AppRole;
}[] = [
  { prefix: "/admin/audit", minRole: "admin" },
  { prefix: "/admin/analytics", minRole: "admin" },
  { prefix: "/admin/finance", minRole: "admin" },
  { prefix: "/admin/payouts", minRole: "admin" },
  { prefix: "/admin/reports", minRole: "moderator" },
  { prefix: "/admin/users", minRole: "admin" },
  { prefix: "/admin/creators", minRole: "admin" },
  { prefix: "/admin/moderation", minRole: "moderator" },
  { prefix: "/admin", minRole: "moderator" },
  { prefix: "/creator", minRole: "creator" },
  { prefix: "/feed", minRole: "user" },
  { prefix: "/discover", minRole: "user" },
  { prefix: "/subscriptions", minRole: "user" },
  { prefix: "/messages", minRole: "user" },
  { prefix: "/notifications", minRole: "user" },
  { prefix: "/settings", minRole: "user" },
];

/** Safe redirect target after login (relative path only). */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (next.includes("\\") || next.includes("\0") || /[\r\n]/.test(next)) {
    return null;
  }
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return null;
  if (next.startsWith("/login") || next.startsWith("/signup")) return null;
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const u = new URL(next, base);
    const b = new URL(base);
    if (u.origin !== b.origin) return null;
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isResetPasswordPath(pathname: string): boolean {
  return pathname === "/reset-password";
}

export function getRequiredRoleForPath(pathname: string): AppRole | null {
  const match = PROTECTED_ROUTE_PREFIXES.filter(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];

  return match?.minRole ?? null;
}

export function canAccessPath(pathname: string, role: AppRole): boolean {
  const required = getRequiredRoleForPath(pathname);
  if (!required) return true;
  return hasMinimumRole(role, required);
}

/** @deprecated use getRequiredRoleForPath */
export function isProtectedFanPath(pathname: string): boolean {
  return getRequiredRoleForPath(pathname) === "user";
}
