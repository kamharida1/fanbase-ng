import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

import { CreatorPublicProfile } from "@/components/creator/creator-public-profile";
import { getCreatorByUsername } from "@/lib/creators/queries";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { listCreatorPublishedPosts } from "@/lib/posts/queries";
import { getCreatorPageSubscriptionState } from "@/lib/subscriptions/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

// CDN serves the anonymous render for up to 10 minutes.
// Logged-in users always get a fresh render (their session cookie prevents
// CDN caching), so subscription state and post visibility are always correct.
export const revalidate = 600;

type PageProps = { params: Promise<{ username: string }> };

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

export default async function CreatorPublicPage({ params }: PageProps) {
  const { username } = await params;

  // Cached: public creator info (name, bio, plans, social links).
  // Same for every visitor — safe to serve from the data cache.
  const creator = await getCreatorCached(username);
  if (!creator) notFound();

  // Dynamic: per-request auth context determines subscription state and
  // which post bodies are visible to this specific viewer.
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);

  const [subscriptionState, posts] = await Promise.all([
    getCreatorPageSubscriptionState(
      supabase,
      auth?.userId ?? null,
      creator.user_id,
    ),
    listCreatorPublishedPosts(
      supabase,
      creator.user_id,
      auth?.userId ?? null,
      12,
    ),
  ]);

  return (
    <CreatorPublicProfile
      creator={creator}
      subscriptionState={subscriptionState}
      isLoggedIn={Boolean(auth)}
      posts={posts}
    />
  );
}
