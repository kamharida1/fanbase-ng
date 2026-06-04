import type { PostRow } from "@/types/posts";

export type FeedCursor = {
  score: number;
  publishedAt: string;
  id: string;
};

export type FeedPage = {
  posts: PostRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type FeedPostDto = PostRow & {
  feed_score?: number;
};
