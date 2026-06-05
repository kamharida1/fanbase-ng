import Link from "next/link";

import { LiveBadge } from "@/components/live/live-badge";
import { VerifiedBadge } from "@/components/creator/verified-badge";
import { CATEGORY_MAP } from "@/lib/creators/categories";
import { formatNgnFromKobo } from "@/lib/creators/format";
import type { CreatorListItem } from "@/types/creator";

export function CreatorCard({ creator }: { creator: CreatorListItem }) {
  const label = creator.display_name ?? creator.username;
  const initial = label.charAt(0).toUpperCase();

  return (
    <Link
      href={`/creators/${creator.username}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[3/1] bg-muted">
        {creator.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creator.avatar_url}
            alt=""
            className="h-full w-full object-cover opacity-50"
          />
        ) : null}
        {creator.is_live ? (
          <div className="absolute left-3 top-3">
            <LiveBadge />
          </div>
        ) : null}
      </div>
      <div className="relative px-4 pb-4">
        <div className="-mt-8 mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-muted text-xl font-semibold">
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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold group-hover:underline">{label}</h2>
          {creator.is_verified ? <VerifiedBadge /> : null}
          {creator.is_live ? <LiveBadge /> : null}
        </div>
        <p className="text-sm text-muted-foreground">@{creator.username}</p>
        {creator.bio ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {creator.bio}
          </p>
        ) : null}
        {creator.categories && creator.categories.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {creator.categories.slice(0, 2).map((cat) => {
              const meta = CATEGORY_MAP.get(cat as Parameters<typeof CATEGORY_MAP.get>[0]);
              return meta ? (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.label}
                </span>
              ) : null;
            })}
          </div>
        ) : null}
        {creator.min_price_kobo != null ? (
          <p className="mt-3 text-sm font-medium">
            From {formatNgnFromKobo(creator.min_price_kobo)}/mo
          </p>
        ) : null}
      </div>
    </Link>
  );
}
