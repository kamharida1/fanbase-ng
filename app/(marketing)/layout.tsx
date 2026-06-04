import Link from "next/link";

import { APP_NAME } from "@/config/constants";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-6xl min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
            {APP_NAME}
          </Link>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3 sm:gap-6">
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
          </div>
        </nav>
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
          </nav>
        </div>
      </footer>
    </div>
  );
}
