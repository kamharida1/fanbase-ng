import Link from "next/link";

import { CreatorCard } from "@/components/creator/creator-card";
import { listCreators } from "@/lib/creators/queries";
import {
  createPublicClient,
  hasPublicSupabaseEnv,
} from "@/lib/supabase/public";

export const revalidate = 3600;

export default async function DiscoverCreatorsPage() {
  const creators = hasPublicSupabaseEnv()
    ? await listCreators(createPublicClient(), { limit: 24 })
    : [];

  return (
    <main className="mx-auto min-w-0 max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Discover creators</h1>
          <p className="mt-2 text-muted-foreground">
            Support Nigerian creators with monthly subscriptions.
          </p>
        </div>
        <Link
          href="/signup"
          className="text-sm font-medium underline underline-offset-4"
        >
          Become a creator
        </Link>
      </div>

      {creators.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">
          No creators published yet. Check back soon.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((creator) => (
            <CreatorCard key={creator.user_id} creator={creator} />
          ))}
        </div>
      )}
    </main>
  );
}
