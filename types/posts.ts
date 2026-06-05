export type PostVisibility = "public" | "subscribers" | "tier" | "ppv";
export type PostStatus = "draft" | "processing" | "published" | "archived" | "removed";
export type PostType = "text" | "image" | "video";

export type PostMediaRow = {
  id: string;
  post_id: string;
  media_type: "image" | "video" | "audio" | "document";
  r2_key: string | null;
  stream_uid: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  byte_size: number | null;
  sort_order: number;
  processing_status: string;
  url?: string | null;
};

export type PostStats = {
  likes?: number;
  comments?: number;
};

export type PostAuthor = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type PostRow = {
  id: string;
  creator_id: string;
  type: PostType;
  caption: string | null;
  visibility: PostVisibility;
  plan_id: string | null;
  ppv_price_kobo: number | null;
  status: PostStatus;
  moderation_status: string;
  published_at: string | null;
  scheduled_publish_at: string | null;
  created_at: string;
  updated_at: string;
  stats_cache: PostStats;
  author?: PostAuthor;
  media?: PostMediaRow[];
  liked_by_me?: boolean;
  can_view_full?: boolean;
  comment_count?: number;
  like_count?: number;
};

export type PostCommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
  is_pinned?: boolean;
  author?: PostAuthor;
};
