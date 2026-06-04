-- Migration: 10 — Posts, media, engagement
-- Fanbase NG
-- Brownfield: legacy PrivyChat tables may lack Fanbase columns before indexes run.

CREATE OR REPLACE FUNCTION public.fanbase_add_column_if_missing(
  p_table text,
  p_column text,
  p_definition text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN %I %s',
      p_table,
      p_column,
      p_definition
    );
  END IF;
END;
$$;

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT posts_ppv_visibility CHECK (
    (visibility = 'ppv' AND ppv_price_kobo IS NOT NULL) OR (visibility <> 'ppv')
  ),
  CONSTRAINT posts_tier_visibility CHECK (
    (visibility = 'tier' AND plan_id IS NOT NULL) OR (visibility <> 'tier')
  )
);

SELECT public.fanbase_add_column_if_missing('posts', 'type', 'TEXT DEFAULT ''text''');
SELECT public.fanbase_add_column_if_missing('posts', 'visibility', 'post_visibility DEFAULT ''subscribers''');
SELECT public.fanbase_add_column_if_missing('posts', 'plan_id', 'UUID');
SELECT public.fanbase_add_column_if_missing('posts', 'ppv_price_kobo', 'BIGINT');
SELECT public.fanbase_add_column_if_missing('posts', 'published_at', 'TIMESTAMPTZ');
SELECT public.fanbase_add_column_if_missing('posts', 'status', 'post_status DEFAULT ''draft''');
SELECT public.fanbase_add_column_if_missing('posts', 'moderation_status', 'moderation_status DEFAULT ''pending''');
SELECT public.fanbase_add_column_if_missing('posts', 'removed_at', 'TIMESTAMPTZ');
SELECT public.fanbase_add_column_if_missing('posts', 'stats_cache', 'JSONB DEFAULT ''{}''');
SELECT public.fanbase_add_column_if_missing('posts', 'updated_at', 'TIMESTAMPTZ DEFAULT now()');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'posts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE public.posts
      ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(caption, ''))
      ) STORED;
  END IF;
END $$;

UPDATE public.posts SET status = 'published'::post_status
WHERE status IS NULL AND published_at IS NOT NULL;

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

-- Brownfield: legacy post_media (PrivyChat). Use ADD COLUMN IF NOT EXISTS so the CLI
-- cannot skip these the way it may skip SELECT fanbase_add_column_if_missing(...).
DO $post_media_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_media'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS post_id UUID;
  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS media_type post_media_type NOT NULL DEFAULT 'image';
  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS r2_key TEXT;
  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS stream_uid TEXT;
  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS duration_seconds INT;
  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS byte_size BIGINT;
  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS processing_status media_processing_status NOT NULL DEFAULT 'uploading';
  ALTER TABLE public.post_media ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'post_media' AND column_name = 'post_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'post_media' AND column_name = 'sort_order'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_post_media_post_order'
  ) THEN
    CREATE INDEX idx_post_media_post_order ON public.post_media (post_id, sort_order);
  END IF;
END $post_media_brownfield$;

CREATE TABLE IF NOT EXISTS post_likes (
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fan_id, post_id)
);

DO $post_likes_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_likes'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.post_likes ADD COLUMN IF NOT EXISTS fan_id UUID;
  ALTER TABLE public.post_likes ADD COLUMN IF NOT EXISTS post_id UUID;
  ALTER TABLE public.post_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'post_likes' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_post_likes_post'
  ) THEN
    CREATE INDEX idx_post_likes_post ON public.post_likes (post_id, created_at DESC);
  END IF;
END $post_likes_brownfield$;

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

DO $post_comments_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_comments'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS parent_id UUID;
  ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'post_comments' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_post_comments_post_created'
  ) THEN
    CREATE INDEX idx_post_comments_post_created
      ON public.post_comments (post_id, created_at DESC)
      WHERE is_deleted = false;
  END IF;
END $post_comments_brownfield$;

CREATE TABLE IF NOT EXISTS post_views (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  viewer_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $post_views_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_views'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.post_views ADD COLUMN IF NOT EXISTS post_id UUID;
  ALTER TABLE public.post_views ADD COLUMN IF NOT EXISTS viewer_id UUID;
  ALTER TABLE public.post_views ADD COLUMN IF NOT EXISTS session_id TEXT;
  ALTER TABLE public.post_views ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'post_views' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_post_views_post_created'
  ) THEN
    CREATE INDEX idx_post_views_post_created ON public.post_views (post_id, created_at DESC);
  END IF;
END $post_views_brownfield$;

CREATE TABLE IF NOT EXISTS ppv_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ppv_purchases_fan_post UNIQUE (fan_id, post_id)
);

DO $ppv_purchases_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ppv_purchases'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.ppv_purchases ADD COLUMN IF NOT EXISTS fan_id UUID;
  ALTER TABLE public.ppv_purchases ADD COLUMN IF NOT EXISTS post_id UUID;
  ALTER TABLE public.ppv_purchases ADD COLUMN IF NOT EXISTS payment_id UUID;
  ALTER TABLE public.ppv_purchases ADD COLUMN IF NOT EXISTS amount_kobo BIGINT;
  ALTER TABLE public.ppv_purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ppv_purchases' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_ppv_purchases_fan'
  ) THEN
    CREATE INDEX idx_ppv_purchases_fan ON public.ppv_purchases (fan_id, created_at DESC);
  END IF;
END $ppv_purchases_brownfield$;

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

DO $tips_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tips'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS fan_id UUID;
  ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS creator_id UUID;
  ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS post_id UUID;
  ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS payment_id UUID;
  ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS amount_kobo BIGINT;
  ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS message TEXT;
  ALTER TABLE public.tips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tips' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_tips_creator_created'
  ) THEN
    CREATE INDEX idx_tips_creator_created ON public.tips (creator_id, created_at DESC);
  END IF;
END $tips_brownfield$;

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
