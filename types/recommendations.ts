export type RecommendedCreator = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  category: string[];
  is_verified: boolean;
  feed_priority: number;
  active_sub_count: number;
  recommendation_score: number;
};
