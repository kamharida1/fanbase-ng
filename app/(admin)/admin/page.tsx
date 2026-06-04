import Link from "next/link";

import { AdminStatGrid } from "@/components/admin/admin-stat-grid";
import { getAdminDashboardStats } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QUICK_LINKS = [
  { href: "/admin/moderation", label: "Review content", desc: "Pending posts" },
  { href: "/admin/reports", label: "Reports", desc: "User reports" },
  { href: "/admin/payouts", label: "Payouts", desc: "Approve withdrawals" },
  { href: "/admin/users", label: "Users", desc: "Account management" },
  { href: "/admin/finance", label: "Finance", desc: "Platform revenue" },
  { href: "/admin/analytics", label: "Analytics", desc: "Trends & leaders" },
];

export default async function AdminDashboardPage() {
  const admin = await createStaffAdminClient();
  const stats = await getAdminDashboardStats(admin);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Platform operations, moderation, finance, and user management.
        </p>
      </div>

      <AdminStatGrid stats={stats} />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{link.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{link.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
