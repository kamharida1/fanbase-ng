-- Fix: messages idempotency_key unique index was created without the partition key.
-- messages is partitioned by created_at, so any unique index must include it.
-- The original CREATE UNIQUE INDEX in 20260620000003 omitted created_at and failed
-- silently; this migration creates the correct index.
DROP INDEX IF EXISTS idx_messages_idempotency_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency_key
  ON messages (idempotency_key, created_at)
  WHERE idempotency_key IS NOT NULL;
