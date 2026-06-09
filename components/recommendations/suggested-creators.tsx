import Link from "next/link";

import { Avatar } from "@/components/shared/avatar";
import { VerifiedBadge } from "@/components/creator/verified-badge";
import { CATEGORY_MAP } from "@/lib/creators/categories";
import type { RecommendedCreator } from "@/types/recommendations";

type Props = {
  creators: RecommendedCreator[];
  heading?: string;
};

export function SuggestedCreators({
  creators,
  heading = "Suggested for you",
}: Props) {
  if (creators.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold">{heading}</h2>

      <div className="-mx-4 mt-4 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-3 pb-1">
          {creators.map((creator) => (
            <SuggestedCreatorCard key={creator.user_id} creator={creator} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SuggestedCreatorCard({ creator }: { creator: RecommendedCreator }) {
  const label = creator.display_name ?? creator.username;
  const firstCat = creator.category?.[0];
  const catMeta = firstCat
    ? CATEGORY_MAP.get(firstCat as Parameters<typeof CATEGORY_MAP.get>[0])
    : null;

  return (
    <Link
      href={`/creators/${creator.username}`}
      className="group flex w-40 flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-shadow hover:shadow-md"
    >
      <Avatar src={creator.avatar_url} alt={label} size={56} />

      <div className="min-w-0 w-full">
        <div className="flex items-center justify-center gap-1">
          <p className="truncate font-semibold text-sm group-hover:underline">
            {label}
          </p>
          {creator.is_verified ? <VerifiedBadge /> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">@{creator.username}</p>

        {catMeta ? (
          <p className="mt-1 text-xs text-muted-foreground">
            <span aria-hidden>{catMeta.emoji}</span> {catMeta.label}
          </p>
        ) : null}

        {creator.active_sub_count > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {creator.active_sub_count.toLocaleString()} subscriber
            {creator.active_sub_count !== 1 ? "s" : ""}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
