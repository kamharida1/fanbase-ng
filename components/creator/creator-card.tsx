import Link from "next/link";

import { VerifiedBadge } from "@/components/creator/verified-badge";
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
        </div>
        <p className="text-sm text-muted-foreground">@{creator.username}</p>
        {creator.bio ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {creator.bio}
          </p>
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
