-- Live streams: one row per stream session per creator
create table if not exists live_streams (
  id                uuid primary key default gen_random_uuid(),
  creator_id        uuid not null references profiles(id) on delete cascade,
  title             text not null default 'Live stream',
  status            text not null default 'idle'
                      check (status in ('idle', 'live', 'ended')),
  cloudflare_uid    text unique,
  rtmps_url         text,          -- RTMP server URL (creator-only)
  stream_key        text,          -- RTMP stream key (creator-only, sensitive)
  embed_url         text,          -- Cloudflare iframe URL for viewers
  viewer_count      integer not null default 0,
  thumbnail_url     text,
  started_at        timestamptz,
  ended_at          timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists live_streams_creator_id_idx on live_streams (creator_id);
create index if not exists live_streams_status_idx     on live_streams (status, created_at desc);

alter table live_streams enable row level security;

-- Creators can fully manage their own streams (includes RTMP keys)
create policy "live_streams_creator_all" on live_streams
  for all to authenticated
  using  (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- Any authenticated user can see currently live streams
create policy "live_streams_viewer_select" on live_streams
  for select to authenticated
  using (status = 'live');

-- Unauthenticated visitors can also see live status (for public profiles)
create policy "live_streams_anon_select" on live_streams
  for select to anon
  using (status = 'live');

-- Trigger: keep updated_at current
create or replace function set_live_streams_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger live_streams_updated_at
  before update on live_streams
  for each row execute function set_live_streams_updated_at();

-- Add creator_live notification type
-- Drop the existing check constraint and recreate it with the new value.
-- The constraint may have been created with a generated name; we find it
-- dynamically to avoid hard-coding the name here.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from   pg_constraint c
  join   pg_class t on t.oid = c.conrelid
  where  t.relname = 'notifications'
    and  c.contype = 'c'
    and  pg_get_constraintdef(c.oid) like '%type%';

  if v_constraint is not null then
    execute format('alter table notifications drop constraint %I', v_constraint);
  end if;

  alter table notifications add constraint notifications_type_check
    check (type in (
      'new_subscriber',
      'new_message',
      'new_comment',
      'new_like',
      'new_payout',
      'creator_live'
    ));
end $$;
