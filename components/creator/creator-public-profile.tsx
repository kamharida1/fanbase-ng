import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { PostCard } from "@/components/posts/post-card";
import { VerifiedBadge } from "@/components/creator/verified-badge";
import { MessageCreatorButton } from "@/components/messaging/message-creator-button";
import { SubscribeButton } from "@/components/subscriptions/subscribe-button";
import { formatPlanPrice } from "@/lib/subscriptions/format";
import type { CreatorPageSubscriptionState } from "@/lib/subscriptions/queries";
import type { CreatorProfilePublic, SocialLinks } from "@/types/creator";
import type { PostRow } from "@/types/posts";

const SOCIAL_LABELS: Record<keyof SocialLinks, string> = {
  website: "Website",
  twitter: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export function CreatorPublicProfile({
  creator,
  subscriptionState,
  isLoggedIn,
  posts = [],
}: {
  creator: CreatorProfilePublic;
  subscriptionState: CreatorPageSubscriptionState;
  isLoggedIn: boolean;
  posts?: PostRow[];
}) {
  const label = creator.display_name ?? creator.username;
  const initial = label.charAt(0).toUpperCase();
  const socialEntries = Object.entries(creator.social_links).filter(
    ([, url]) => url,
  ) as [keyof SocialLinks, string][];
  const loginNext = `/creators/${creator.username}`;

  return (
    <div className="min-w-0 overflow-x-clip pb-16">
      <div className="relative h-40 sm:h-56 bg-muted md:h-64">
        {creator.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creator.banner_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-neutral-200 to-neutral-400 dark:from-neutral-800 dark:to-neutral-600" />
        )}
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-3 sm:gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted text-2xl font-bold shadow-sm sm:h-28 sm:w-28 sm:text-3xl">
              {creator.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creator.avatar_url}
                  alt={label}
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-bold sm:text-3xl">
                  {label}
                </h1>
                {creator.is_verified ? <VerifiedBadge /> : null}
              </div>
              <p className="text-muted-foreground">@{creator.username}</p>
            </div>
          </div>
          <div className="shrink-0 sm:pb-1">
            <MessageCreatorButton
              creatorId={creator.user_id}
              isLoggedIn={isLoggedIn}
              loginNext={loginNext}
            />
          </div>
        </div>

        {creator.bio ? (
          <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed">
            {creator.bio}
          </p>
        ) : null}

        {socialEntries.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {socialEntries.map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
              >
                {SOCIAL_LABELS[key]}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        ) : null}

        {posts.length > 0 ? (
          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-semibold">Posts</h2>
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Subscription plans</h2>
          {!creator.is_accepting_subscribers ? (
            <p className="mt-2 text-muted-foreground">
              This creator is not accepting new subscribers right now.
            </p>
          ) : creator.plans.length === 0 ? (
            <p className="mt-2 text-muted-foreground">
              No plans published yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {creator.plans.map((plan) => (
                <li
                  key={plan.id}
                  className="flex flex-col rounded-xl border p-5"
                >
                  <h3 className="font-semibold">{plan.name}</h3>
                  {plan.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  ) : null}
                  <p className="mt-4 text-2xl font-bold">
                    {formatPlanPrice(plan.price_kobo, plan.billing_interval)}
                  </p>
                  {plan.trial_days > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.trial_days}-day free trial
                    </p>
                  ) : null}
                  <SubscribeButton
                    planId={plan.id}
                    planName={plan.name}
                    isFree={plan.billing_interval === "free"}
                    subscriptionState={subscriptionState}
                    isLoggedIn={isLoggedIn}
                    loginNext={loginNext}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/creators" className="underline">
            Discover more creators
          </Link>
        </p>
      </div>
    </div>
  );
}
