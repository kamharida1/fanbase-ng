import Link from "next/link";

import { APP_NAME } from "@/config/constants";
import { MarketingNav } from "@/components/layout/marketing-nav";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <MarketingNav />
      </header>

      <div className="min-w-0 flex-1">{children}</div>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/creators" className="hover:text-foreground">
              Explore creators
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Sign up
            </Link>
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
