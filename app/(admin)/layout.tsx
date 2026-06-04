import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import { AuthShell } from "@/components/auth/auth-shell";
import { getAdminNavForRole } from "@/lib/auth/admin-nav";
import { requireRole } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, "moderator");

  const staffRoles = ["moderator", "admin", "super_admin"] as const;
  if (!staffRoles.includes(auth.appRole as (typeof staffRoles)[number])) {
    redirect("/feed");
  }

  const nav = getAdminNavForRole(auth.appRole).map((item) => ({
    href: item.href,
    label: item.label,
  }));

  return (
    <AuthShell auth={auth} nav={nav} variant="admin">
      {children}
    </AuthShell>
  );
}
