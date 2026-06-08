import { HomeFeed } from "@/components/feed/home-feed";
import { StoryStrip } from "@/components/feed/story-strip";
import { VerifyCheckout } from "@/components/subscriptions/verify-checkout";
import { FEED_PAGE_SIZE } from "@/lib/feed/constants";
import { FeedUnavailableError } from "@/lib/feed/errors";
import { getHomeFeedPage } from "@/lib/feed/queries";
import { getStoryGroups } from "@/lib/stories/queries";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { buildWatermarkLabel } from "@/lib/media/watermark";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ reference?: string; ppv?: string }>;
};

export default async function FeedPage({ searchParams }: PageProps) {
  const { reference, ppv } = await searchParams;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/feed");

  const watermarkLabel = buildWatermarkLabel({
    username: auth.profile.username,
    userId: auth.userId,
  });

  const [storyGroups, page] = await Promise.all([
    getStoryGroups(supabase, auth.userId),
    (async () => {
      try {
        return await getHomeFeedPage(supabase, auth.userId, {
          limit: FEED_PAGE_SIZE,
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
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Home</h1>
        <p className="mt-2 text-muted-foreground">
          Personalized feed from creators you subscribe to and public posts.
        </p>
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

      <HomeFeed
        initialPosts={page.posts}
        initialCursor={page.nextCursor}
        initialHasMore={page.hasMore}
        viewerId={auth.userId}
        watermarkLabel={watermarkLabel}
      />
    </div>
  );
}
