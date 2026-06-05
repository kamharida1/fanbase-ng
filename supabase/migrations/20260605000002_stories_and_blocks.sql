-- ── Stories extension to posts ────────────────────────────────────────────
alter table posts add column if not exists is_story  boolean      not null default false;
alter table posts add column if not exists expires_at timestamptz;

-- Fast lookup: active stories per creator (for feed strip)
create index if not exists posts_active_stories_idx
  on posts (creator_id, expires_at desc)
  where is_story = true and status = 'published';

-- ── Story views (unread ring tracking) ────────────────────────────────────
create table if not exists story_views (
  story_id   uuid not null references posts(id) on delete cascade,
  viewer_id  uuid not null references profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table story_views enable row level security;

create policy "story_views_own" on story_views
  for all to authenticated
  using  (viewer_id = auth.uid())
  with check (viewer_id = auth.uid());

-- ── Creator blocks ─────────────────────────────────────────────────────────
create table if not exists creator_blocks (
  creator_id uuid not null references profiles(id) on delete cascade,
  fan_id     uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (creator_id, fan_id)
);

create index if not exists creator_blocks_fan_idx on creator_blocks (fan_id);

alter table creator_blocks enable row level security;

-- Creators manage their own blocks; fans can check if they are blocked
create policy "creator_manages_blocks" on creator_blocks
  for all to authenticated
  using  (creator_id = auth.uid() or fan_id = auth.uid())
  with check (creator_id = auth.uid());
