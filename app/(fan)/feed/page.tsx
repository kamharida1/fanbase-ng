import { HomeFeed } from "@/components/feed/home-feed";
import { FeedEmptyGuide } from "@/components/feed/feed-empty-guide";
import { SuggestedCreators } from "@/components/recommendations/suggested-creators";
import { StoryStrip } from "@/components/feed/story-strip";
import { VerifyCheckout } from "@/components/subscriptions/verify-checkout";
import { FEED_PAGE_SIZE } from "@/lib/feed/constants";
import { FeedUnavailableError } from "@/lib/feed/errors";
import { getHomeFeedPage } from "@/lib/feed/queries";
import { getRecommendedCreators } from "@/lib/recommendations/queries";
import { getStoryGroups } from "@/lib/stories/queries";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { buildWatermarkLabel } from "@/lib/media/watermark";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ reference?: string; ppv?: string; published?: string }>;
};

export default async function FeedPage({ searchParams }: PageProps) {
  const { reference, ppv, published } = await searchParams;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/feed");

  const watermarkLabel = buildWatermarkLabel({
    username: auth.profile.username,
    userId: auth.userId,
  });

  const [storyGroups, page, suggestedCreators] = await Promise.all([
    getStoryGroups(supabase, auth.userId),
    (async () => {
      try {
        return await getHomeFeedPage(supabase, auth.userId, {
          limit: FEED_PAGE_SIZE,
          skipCache: published === "1",
        });
      } catch (err) {
        if (err instanceof FeedUnavailableError) {
          throw new Error(
            "Your feed is temporarily unavailable. Please refresh in a moment.",
          );
        }
        throw err;
      }
    })(),
    getRecommendedCreators(supabase, auth.userId, 8),
  ]);

  const feedIsEmpty = page.posts.length === 0;
  const isCreator = auth.appRole === "creator";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feed</h1>
        <p className="mt-2 text-muted-foreground">
          Personalized feed from creators you subscribe to and public posts.
        </p>
        {published === "1" ? (
          <div
            className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
            role="status"
          >
            <p className="font-medium">Your post is live.</p>
            <p className="mt-1 text-emerald-900/80 dark:text-emerald-100/80">
              It should appear below and on your public profile. Photos may take
              a few seconds to finish processing.
            </p>
          </div>
        ) : null}
        {ppv === "success" && reference ? (
          <VerifyCheckout
            reference={reference}
            successRedirect="/feed?ppv=unlocked"
          />
        ) : null}
      </div>

      {storyGroups.length > 0 ? (
        <StoryStrip groups={storyGroups} />
      ) : null}

      {feedIsEmpty ? (
        <FeedEmptyGuide
          suggestedCreators={suggestedCreators}
          isCreator={isCreator}
        />
      ) : suggestedCreators.length > 0 ? (
        <SuggestedCreators
          creators={suggestedCreators}
          heading="Creators you might like"
        />
      ) : null}

      <HomeFeed
        initialPosts={page.posts}
        initialCursor={page.nextCursor}
        initialHasMore={page.hasMore}
        viewerId={auth.userId}
        watermarkLabel={watermarkLabel}
        hideEmptyState={feedIsEmpty}
      />
    </div>
  );
}
