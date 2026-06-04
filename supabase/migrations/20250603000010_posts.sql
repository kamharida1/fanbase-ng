-- Migration: 10 — Posts, media, engagement
-- Fanbase NG

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  caption TEXT,
  visibility post_visibility NOT NULL DEFAULT 'subscribers',
  plan_id UUID REFERENCES subscription_plans(id),
  ppv_price_kobo BIGINT CHECK (ppv_price_kobo IS NULL OR ppv_price_kobo > 0),
  status post_status NOT NULL DEFAULT 'draft',
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  published_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  stats_cache JSONB NOT NULL DEFAULT '{}',
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(caption, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT posts_ppv_visibility CHECK (
    (visibility = 'ppv' AND ppv_price_kobo IS NOT NULL) OR (visibility <> 'ppv')
  ),
  CONSTRAINT posts_tier_visibility CHECK (
    (visibility = 'tier' AND plan_id IS NOT NULL) OR (visibility <> 'tier')
  )
);

CREATE INDEX IF NOT EXISTS idx_posts_creator_published
  ON posts (creator_id, published_at DESC NULLS LAST)
  WHERE status = 'published' AND removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_moderation_queue
  ON posts (created_at)
  WHERE moderation_status = 'pending' AND status <> 'removed';

CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_type post_media_type NOT NULL,
  r2_key TEXT,
  stream_uid TEXT,
  thumbnail_url TEXT,
  duration_seconds INT CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  byte_size BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  processing_status media_processing_status NOT NULL DEFAULT 'uploading',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_media_storage_ref CHECK (r2_key IS NOT NULL OR stream_uid IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_order ON post_media (post_id, sort_order);

CREATE TABLE IF NOT EXISTS post_likes (
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fan_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_created
  ON post_comments (post_id, created_at DESC)
  WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS post_views (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  viewer_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_post_views_post_created ON post_views (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ppv_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ppv_purchases_fan_post UNIQUE (fan_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_ppv_purchases_fan ON ppv_purchases (fan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tips_creator_created ON tips (creator_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_post_fk'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_post_fk
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL;
  END IF;
END $$;
