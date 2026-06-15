import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import { AuthShell, getShellNavForRole } from "@/components/auth/auth-shell";
import { CreatorBottomNav, FanBottomNav } from "@/components/layout/bottom-nav";
import { requireRole } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export default async function FanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, "user");

  if (
    auth.appRole === "moderator" ||
    auth.appRole === "admin" ||
    auth.appRole === "super_admin"
  ) {
    redirect("/admin/moderation");
  }

  return (
    <AuthShell
      auth={auth}
      nav={getShellNavForRole(auth.appRole)}
      bottomNav={
        auth.appRole === "creator" ? (
          <CreatorBottomNav />
        ) : (
          <FanBottomNav />
        )
      }
    >
      {children}
    </AuthShell>
  );
}
