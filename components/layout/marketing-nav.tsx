import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { getHomeHrefForAuth } from "@/lib/auth/nav";
import { isStaffRole } from "@/lib/auth/rbac";
import { APP_NAME } from "@/config/constants";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export async function MarketingNav() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);

  return (
    <nav className="mx-auto flex max-w-6xl min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
        {APP_NAME}
      </Link>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-3 sm:gap-6">
        {auth ? (
          <>
            <Link
              href={getHomeHrefForAuth(auth)}
              className="text-sm font-medium transition-colors hover:text-foreground"
            >
              Feed
            </Link>
            <Link
              href="/discover"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Discover
            </Link>
            {auth.profile.role === "creator" ? (
              <Link
                href="/creator/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Studio
              </Link>
            ) : null}
            {isStaffRole(auth.appRole) ? (
              <Link
                href="/admin"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Admin
              </Link>
            ) : null}
            <SignOutButton />
          </>
        ) : (
          <>
            <Link
              href="/creators"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Explore creators
            </Link>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link href="/login" className="text-sm font-medium">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Get started
              </Link>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
