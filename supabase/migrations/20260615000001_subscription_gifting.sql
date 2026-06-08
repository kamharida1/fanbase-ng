-- ── Subscription gifting ───────────────────────────────────────────────────
-- Lets a fan pay for a prepaid, fixed-duration subscription on behalf of
-- someone else. Mechanically identical to a bundle purchase (one-time charge,
-- cancel_at_period_end = true, period spans the gifted duration) except the
-- subscription is activated for the recipient rather than the payer.
create table if not exists subscription_gifts (
  id              uuid primary key default gen_random_uuid(),
  gifter_id       uuid not null references profiles(id) on delete cascade,
  recipient_id    uuid not null references profiles(id) on delete cascade,
  creator_id      uuid not null references profiles(id) on delete cascade,
  plan_id         uuid not null references subscription_plans(id) on delete cascade,
  months          smallint not null check (months in (1, 3, 6, 12)),
  amount_kobo     bigint not null check (amount_kobo > 0),
  message         text,
  status          text not null default 'pending' check (status in ('pending', 'fulfilled', 'failed')),
  payment_id      uuid references payments(id) on delete set null,
  subscription_id uuid references subscriptions(id) on delete set null,
  fulfilled_at    timestamptz,
  created_at      timestamptz not null default now(),
  constraint subscription_gifts_not_self check (gifter_id <> recipient_id)
);

create index if not exists idx_subscription_gifts_gifter on subscription_gifts (gifter_id, created_at desc);
create index if not exists idx_subscription_gifts_recipient on subscription_gifts (recipient_id, created_at desc);

alter table subscription_gifts enable row level security;

create policy "subscription_gifts_sender_read" on subscription_gifts
  for select to authenticated
  using (gifter_id = auth.uid());

create policy "subscription_gifts_recipient_read" on subscription_gifts
  for select to authenticated
  using (recipient_id = auth.uid());

alter type notification_type add value if not exists 'gift_subscription';
