-- ── Prepaid subscription bundles (3/6/12-month discounts) ─────────────────
-- Lets a creator offer a discounted, prepaid multi-month commitment on top
-- of a monthly plan. Bundle purchases are one-time charges (no recurring
-- Paystack subscription) that grant N months of access up front.
create table if not exists subscription_plan_bundles (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references profiles(id) on delete cascade,
  plan_id       uuid not null references subscription_plans(id) on delete cascade,
  months        smallint not null check (months in (3, 6, 12)),
  discount_pct  integer not null check (discount_pct between 1 and 99),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Only one active bundle per (plan, duration) combination
create unique index if not exists subscription_plan_bundles_unique_active
  on subscription_plan_bundles (plan_id, months)
  where is_active = true;

create index if not exists subscription_plan_bundles_plan_idx
  on subscription_plan_bundles (plan_id, is_active);

alter table subscription_plan_bundles enable row level security;

create policy "plan_bundles_creator_write" on subscription_plan_bundles
  for all to authenticated
  using  (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "plan_bundles_public_read" on subscription_plan_bundles
  for select to anon, authenticated
  using (is_active = true);
