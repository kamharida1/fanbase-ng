export const FEED_PAGE_SIZE = 15;
export const FEED_MAX_PAGE_SIZE = 30;
export const FEED_CACHE_SECONDS = 60;
export const FEED_STALE_WHILE_REVALIDATE = 120;

/** Ranking weights (see compute_post_feed_score in SQL). */
export const FEED_RANK_WEIGHTS = {
  subscribed: 1000,
  public: 150,
  recencyMax: 100,
  recencyHalfLifeHours: 168,
  engagementMax: 250,
  verifiedBoost: 40,
  priorityMultiplier: 2,
} as const;
