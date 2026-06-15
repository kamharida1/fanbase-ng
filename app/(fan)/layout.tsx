import { AuthShell } from "@/components/auth/auth-shell";
import { CreatorBottomNav, FanBottomNav } from "@/components/layout/bottom-nav";
import {
  getNavForAuth,
  usesCreatorBottomNav,
} from "@/lib/auth/nav";
import { requireRole } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, "user");

  return (
    <AuthShell
      auth={auth}
      nav={getNavForAuth(auth)}
      bottomNav={
        usesCreatorBottomNav(auth) ? (
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
