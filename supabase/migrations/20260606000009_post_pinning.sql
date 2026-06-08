-- Post pinning to creator profile top

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- At most one pinned post per creator (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS posts_creator_pinned_unique
  ON public.posts (creator_id)
  WHERE is_pinned = true AND status = 'published' AND removed_at IS NULL;
