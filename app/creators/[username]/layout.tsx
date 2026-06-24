import { AuthShell } from "@/components/auth/auth-shell";
import { CreatorBottomNav, FanBottomNav } from "@/components/layout/bottom-nav";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getNavForAuth, usesCreatorBottomNav } from "@/lib/auth/nav";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CreatorProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);

  // Logged-in visitors keep the app shell (sidebar/bottom-tabs), matching
  // every other authenticated surface. Logged-out visitors (search engines,
  // shared links) get the lightweight marketing chrome instead.
  if (auth) {
    return (
      <AuthShell
        auth={auth}
        nav={getNavForAuth(auth)}
        bottomNav={
          usesCreatorBottomNav(auth) ? <CreatorBottomNav /> : <FanBottomNav />
        }
      >
        {children}
      </AuthShell>
    );
  }

  return <MarketingShell>{children}</MarketingShell>;
}
