import { hasMinimumRole } from "@/lib/auth/rbac";
import type { AppRole } from "@/types/auth";

export type AdminNavItem = {
  href: string;
  label: string;
  minRole: AppRole;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Admin", minRole: "moderator" },
  { href: "/admin/moderation", label: "Content", minRole: "moderator" },
  { href: "/admin/reports", label: "Reports", minRole: "moderator" },
  { href: "/admin/users", label: "Users", minRole: "admin" },
  { href: "/admin/creators", label: "Creators", minRole: "admin" },
  { href: "/admin/payouts", label: "Payouts", minRole: "admin" },
  { href: "/admin/disputes", label: "Disputes", minRole: "admin" },
  { href: "/admin/appeals", label: "Appeals", minRole: "admin" },
  { href: "/admin/finance", label: "Finance", minRole: "admin" },
  { href: "/admin/analytics", label: "Analytics", minRole: "admin" },
  { href: "/admin/audit", label: "Audit", minRole: "admin" },
];

export function getAdminNavForRole(role: AppRole): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter((item) => hasMinimumRole(role, item.minRole));
}
