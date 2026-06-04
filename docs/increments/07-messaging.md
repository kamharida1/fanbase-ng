# Increment 7 — Messaging (OnlyFans-style)

## Features

| Feature | Implementation |
|---------|----------------|
| Conversations | `conversations` + unique fan/creator pair |
| Direct messages | `messages` (partitioned) + composer |
| Read receipts | `message_reads` + "Read" on sent messages |
| Attachments | `message-media` bucket, signed URLs |
| Real-time | Supabase Realtime on `conversations`, `messages`, `message_reads` |
| Message requests | `conversation_status`: pending → accepted/declined |

## Flow

1. Fan clicks **Message** on creator profile → `get_or_create_conversation` (status `pending`).
2. Fan sends one intro message while pending.
3. Creator sees thread under **Requests** → Accept / Decline (or reply to auto-accept).
4. Accepted threads move to **Inbox**; both parties DM with live updates.
5. Opening a thread calls `mark_conversation_read` (read receipts + unread zeroed).

## Migrations

- `20250608000001_messaging_enhancements.sql` — status, reads, triggers, RPCs, realtime
- `20250608000002_message_media_storage.sql` — private attachment bucket

## Realtime setup

Ensure **Replication** is enabled in Supabase Dashboard for `conversations`, `messages`, and `message_reads` (migration adds tables to `supabase_realtime` publication).

## Key paths

- `lib/messaging/actions.ts` — send, read, requests
- `lib/messaging/realtime.ts` — channel subscriptions
- `components/messaging/messaging-inbox.tsx` — inbox UI
- `/messages` (fan), `/creator/messages` (creator)
