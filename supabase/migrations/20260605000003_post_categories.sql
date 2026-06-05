-- ── Content vault: creator-defined categories ─────────────────────────────
create table if not exists post_categories (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  description text            check (description is null or char_length(description) <= 500),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (creator_id, name)
);

create index if not exists post_categories_creator_idx
  on post_categories (creator_id, sort_order);

alter table post_categories enable row level security;

-- Creators manage their own categories; anyone can read for public profiles
create policy "post_categories_creator_write" on post_categories
  for all to authenticated
  using  (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "post_categories_public_read" on post_categories
  for select to anon, authenticated
  using (true);

-- ── Post ↔ category assignments ────────────────────────────────────────────
create table if not exists post_category_assignments (
  post_id     uuid not null references posts(id) on delete cascade,
  category_id uuid not null references post_categories(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (post_id, category_id)
);

create index if not exists pca_category_idx on post_category_assignments (category_id);
create index if not exists pca_post_idx     on post_category_assignments (post_id);

alter table post_category_assignments enable row level security;

create policy "pca_creator_write" on post_category_assignments
  for all to authenticated
  using (
    exists (
      select 1 from post_categories pc
      where pc.id = category_id and pc.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from post_categories pc
      where pc.id = category_id and pc.creator_id = auth.uid()
    )
  );

create policy "pca_public_read" on post_category_assignments
  for select to anon, authenticated
  using (true);

-- updated_at trigger
create or replace function set_post_categories_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger post_categories_updated_at
  before update on post_categories
  for each row execute function set_post_categories_updated_at();
