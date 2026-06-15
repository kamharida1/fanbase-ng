import { formatNgnFromKobo } from "@/lib/creators/format";
import type { PostRow, PostVisibility } from "@/types/posts";

export type VisibilityMeta = {
  label: string;
  shortLabel: string;
  tone: "default" | "muted" | "accent";
};

const VISIBILITY_META: Record<PostVisibility, VisibilityMeta> = {
  public: {
    label: "Public",
    shortLabel: "Public",
    tone: "default",
  },
  subscribers: {
    label: "Subscribers only",
    shortLabel: "Subscribers",
    tone: "accent",
  },
  tier: {
    label: "Tier exclusive",
    shortLabel: "Tier",
    tone: "accent",
  },
  ppv: {
    label: "Pay to unlock",
    shortLabel: "PPV",
    tone: "accent",
  },
};

export function getPostVisibilityMeta(
  visibility: PostVisibility,
): VisibilityMeta {
  return VISIBILITY_META[visibility];
}

export function getLockedPostMessage(post: PostRow): {
  title: string;
  detail: string;
} {
  const username = post.author?.username;

  if (post.visibility === "ppv" && post.ppv_price_kobo) {
    return {
      title: `Unlock for ${formatNgnFromKobo(post.ppv_price_kobo)}`,
      detail:
        "This is a one-time purchase. Pay once to view the full post permanently.",
    };
  }

  if (post.visibility === "tier") {
    return {
      title: "Tier members only",
      detail:
        "This post is limited to a specific subscription tier. Check the creator's plans to see which tier includes it.",
    };
  }

  if (post.visibility === "subscribers") {
    return {
      title: "Subscribers only",
      detail: username
        ? `@${username} shared this with paying subscribers. Subscribe on their profile to unlock it.`
        : "Subscribe to this creator to unlock subscriber-only posts.",
    };
  }

  return {
    title: "Locked content",
    detail: "Subscribe to view this post.",
  };
}
