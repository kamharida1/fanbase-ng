import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
        <Link
          href="/creators"
          className="inline-flex h-10 items-center justify-center rounded-md border px-6 text-sm font-medium"
        >
          Explore creators
        </Link>
      </div>
    </main>
  );
}
