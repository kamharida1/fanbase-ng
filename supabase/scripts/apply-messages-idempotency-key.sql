-- Run in Supabase SQL Editor if sendMessage fails with:
-- "Could not find the 'idempotency_key' column of 'messages' in the schema cache"
--
-- Safe to re-run (IF NOT EXISTS).

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency_key
  ON messages (idempotency_key, created_at)
  WHERE idempotency_key IS NOT NULL;
