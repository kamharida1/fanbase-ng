-- ── Subscription offers / discounts ───────────────────────────────────────
create table if not exists subscription_offers (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references profiles(id) on delete cascade,
  plan_id          uuid not null references subscription_plans(id) on delete cascade,
  label            text not null check (char_length(label) between 1 and 120),
  discount_pct     integer not null check (discount_pct between 1 and 99),
  ends_at          timestamptz not null,
  max_redemptions  integer,        -- null = unlimited
  redemption_count integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists subscription_offers_plan_idx
  on subscription_offers (plan_id, is_active, ends_at);

alter table subscription_offers enable row level security;

create policy "offers_creator_write" on subscription_offers
  for all to authenticated
  using  (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "offers_public_read" on subscription_offers
  for select to anon, authenticated
  using (true);

-- ── Comment moderation fields ──────────────────────────────────────────────
alter table post_comments
  add column if not exists is_pinned             boolean not null default false,
  add column if not exists is_hidden_by_creator  boolean not null default false;

-- Only one pinned comment per post
create unique index if not exists post_comments_pinned_once
  on post_comments (post_id)
  where is_pinned = true;
