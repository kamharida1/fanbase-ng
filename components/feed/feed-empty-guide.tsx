import Link from "next/link";
import { Compass, Sparkles, Users } from "lucide-react";

import { SuggestedCreators } from "@/components/recommendations/suggested-creators";
import type { RecommendedCreator } from "@/types/recommendations";

export function FeedEmptyGuide({
  suggestedCreators,
  isCreator,
}: {
  suggestedCreators: RecommendedCreator[];
  isCreator: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-muted/30 px-6 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Your feed is ready — now fill it up</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {isCreator
            ? "Subscribe to other creators, publish your own posts, or browse Discover to see what’s happening."
            : "Follow creators to see their latest posts here. Public posts from across the platform will also appear as you explore."}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/discover"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Compass className="h-4 w-4" aria-hidden />
            Browse Discover
          </Link>
          {isCreator ? (
            <Link
              href="/creator/content/new"
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
            >
              Create a post
            </Link>
          ) : (
            <Link
              href="/creators"
              className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium"
            >
              <Users className="h-4 w-4" aria-hidden />
              Explore creators
            </Link>
          )}
        </div>
      </div>

      {suggestedCreators.length > 0 ? (
        <SuggestedCreators
          creators={suggestedCreators}
          heading="Start by following these creators"
        />
      ) : null}
    </div>
  );
}
