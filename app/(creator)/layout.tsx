export const dynamic = "force-dynamic";

import { AuthShell, CREATOR_NAV } from "@/components/auth/auth-shell";
import { CreatorBottomNav } from "@/components/layout/bottom-nav";
import { requireRole } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export default async function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const auth = await requireRole(supabase, "creator");

  return (
    <AuthShell auth={auth} nav={CREATOR_NAV} bottomNav={<CreatorBottomNav />}>
      {children}
    </AuthShell>
  );
}
