-- Live stream chat messages
create table if not exists live_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  stream_id   uuid not null references live_streams(id) on delete cascade,
  sender_id   uuid not null references profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists live_chat_messages_stream_id_idx
  on live_chat_messages (stream_id, created_at desc);

alter table live_chat_messages enable row level security;

alter publication supabase_realtime add table live_chat_messages;

-- Anyone (including anon, matching live_streams' public visibility) can read
-- chat for a stream that is currently live.
create policy "live_chat_select_when_live" on live_chat_messages
  for select to authenticated, anon
  using (
    exists (
      select 1 from live_streams s
      where s.id = live_chat_messages.stream_id
        and s.status = 'live'
    )
  );

-- Authenticated users can post to a live stream's chat, as themselves,
-- as long as the creator hasn't blocked them.
create policy "live_chat_insert_own" on live_chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from live_streams s
      where s.id = live_chat_messages.stream_id
        and s.status = 'live'
        and not exists (
          select 1 from creator_blocks cb
          where cb.creator_id = s.creator_id
            and cb.fan_id = auth.uid()
        )
    )
  );

-- The stream's creator can delete messages in their own stream (moderation).
create policy "live_chat_delete_own_stream" on live_chat_messages
  for delete to authenticated
  using (
    exists (
      select 1 from live_streams s
      where s.id = live_chat_messages.stream_id
        and s.creator_id = auth.uid()
    )
  );
