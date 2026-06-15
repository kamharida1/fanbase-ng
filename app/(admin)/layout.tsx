import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import { AuthShell } from "@/components/auth/auth-shell";
import { getNavForAuth } from "@/lib/auth/nav";
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

  return (
    <AuthShell auth={auth} nav={getNavForAuth(auth)} variant="admin">
      {children}
    </AuthShell>
  );
}
