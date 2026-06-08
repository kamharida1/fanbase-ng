-- Web push subscriptions: one row per browser/device a user has opted into push on.
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth_key   text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- A user manages only their own subscriptions; service role (push sender) bypasses RLS.
create policy "user_manages_own_push_subscriptions" on push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
