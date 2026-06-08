import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

import { CreatorPublicProfile } from "@/components/creator/creator-public-profile";
import { getCreatorByUsername } from "@/lib/creators/queries";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { buildWatermarkLabel } from "@/lib/media/watermark";
import { getPublicLiveStream } from "@/lib/live/queries";
import { listCreatorPublishedPosts } from "@/lib/posts/queries";
import { getCreatorPageSubscriptionState } from "@/lib/subscriptions/queries";
import { listCreatorCategories, getCategoryPosts } from "@/lib/vault/queries";
import { getActivePlanOffers } from "@/lib/offers/queries";
import { getActivePlanBundles } from "@/lib/subscriptions/bundles";
import { isFanBlockingCreator } from "@/lib/creators/block-actions";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

// CDN serves the anonymous render for up to 10 minutes.
// Logged-in users always get a fresh render (their session cookie prevents
// CDN caching), so subscription state and post visibility are always correct.
export const revalidate = 600;

type PageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tip?: string; reference?: string; col?: string }>;
};

// Creator profile metadata is identical for every visitor.
// Cache it independently of the per-request auth context.
function getCreatorCached(username: string) {
  return unstable_cache(
    () => getCreatorByUsername(createPublicClient(), username),
    [`creator-profile:${username}`],
    { revalidate: 600, tags: [`creator:${username}`] },
  )();
}

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params;
  const creator = await getCreatorCached(username);

  if (!creator) return { title: "Creator not found" };

  const name = creator.display_name ?? creator.username;
  return {
    title: `${name} (@${creator.username})`,
    description: creator.bio ?? `Subscribe to ${name} on Fanbase NG`,
  };
}

export default async function CreatorPublicPage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const { tip, col } = await searchParams;

  // Cached: public creator info (name, bio, plans, social links).
  // Same for every visitor — safe to serve from the data cache.
  const creator = await getCreatorCached(username);
  if (!creator) notFound();

  // Dynamic: per-request auth context determines subscription state and
  // which post bodies are visible to this specific viewer.
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);

  const isOwnProfile = auth?.userId === creator.user_id;
  const watermarkLabel = auth
    ? buildWatermarkLabel({ username: auth.profile.username, userId: auth.userId })
    : null;

  const [subscriptionState, posts, liveStream, categories, planOffers, planBundles, isBlockedByFan] = await Promise.all([
    getCreatorPageSubscriptionState(
      supabase,
      auth?.userId ?? null,
      creator.user_id,
    ),
    col
      ? getCategoryPosts(supabase, col, auth?.userId ?? null, 20)
      : listCreatorPublishedPosts(
          supabase,
          creator.user_id,
          auth?.userId ?? null,
          12,
        ),
    getPublicLiveStream(supabase, creator.user_id),
    listCreatorCategories(supabase, creator.user_id),
    getActivePlanOffers(supabase, creator.plans.map((p) => p.id)),
    getActivePlanBundles(supabase, creator.plans.map((p) => p.id)),
    auth && !isOwnProfile
      ? isFanBlockingCreator(supabase, auth.userId, creator.user_id)
      : Promise.resolve(false),
  ]);

  return (
    <CreatorPublicProfile
      creator={creator}
      subscriptionState={subscriptionState}
      isLoggedIn={Boolean(auth)}
      isOwnProfile={isOwnProfile}
      isBlockedByFan={isBlockedByFan}
      posts={posts}
      liveStream={
        liveStream
          ? {
              embedUrl: liveStream.embed_url ?? "",
              title: liveStream.title,
            }
          : null
      }
      tipSuccess={tip === "success"}
      categories={categories}
      activeCollectionId={col ?? null}
      planOffers={planOffers}
      planBundles={planBundles}
      watermarkLabel={watermarkLabel}
    />
  );
}
