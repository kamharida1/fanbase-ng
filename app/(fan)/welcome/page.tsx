import Image from "next/image";
import Link from "next/link";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { listCreators } from "@/lib/creators/queries";
import { formatNgnFromKobo } from "@/lib/creators/format";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const creators = await listCreators(supabase, { limit: 8 });

  const name = auth.profile.display_name ?? auth.profile.username ?? "there";

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-10">
      {/* Greeting */}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Welcome, {name}!</h1>
        <p className="text-muted-foreground">
          Fanbase NG connects you with Nigerian creators. Subscribe to a creator
          to unlock exclusive content.
        </p>
      </div>

      {/* Featured creators */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Creators to check out</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {creators.map((creator) => (
            <Link
              key={creator.user_id}
              href={`/creators/${creator.username}`}
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              {creator.avatar_url ? (
                <Image
                  src={creator.avatar_url}
                  alt={creator.display_name ?? creator.username}
                  width={48}
                  height={48}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold">
                  {(creator.display_name ?? creator.username).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {creator.display_name ?? creator.username}
                </p>
                {creator.bio ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {creator.bio}
                  </p>
                ) : null}
                {creator.min_price_kobo !== null ? (
                  <p className="mt-0.5 text-xs text-primary">
                    From {formatNgnFromKobo(creator.min_price_kobo)}/mo
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-primary">Free to follow</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTAs */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link href="/discover">Browse all creators</Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/feed">Skip to my feed</Link>
        </Button>
      </div>
    </div>
  );
}
