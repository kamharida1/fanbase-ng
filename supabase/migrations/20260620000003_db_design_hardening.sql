-- Migration: database design hardening
-- Fixes five confirmed gaps found during the 74/100 database design audit:
--   1. Missing fan-first index on post_likes  (hot path: enrichPosts per page load)
--   2. Missing caller_id index on calls       (FK cascade + inbox queries)
--   3. Balance snapshot CHECK constraints     (financial integrity on wallet_transactions)
--   4. Message idempotency key                (prevent duplicate sends on client retry)
--   5. Admin status index on payout_requests  (query filtering by processing/completed/failed)
--   6. Author index on post_comments          (moderation queries by user)
--   7. Explicit service_role policy on paystack_webhook_events (remove deny-by-default ambiguity)

-- ── 1. post_likes: fan-first index ───────────────────────────────────────────
-- enrichPosts queries: WHERE fan_id = $1 AND post_id IN (...).
-- The existing idx_post_likes_post is (post_id, created_at) — wrong leading column.
CREATE INDEX IF NOT EXISTS idx_post_likes_fan_post
  ON post_likes (fan_id, post_id);

-- ── 2. calls: caller_id index ────────────────────────────────────────────────
-- idx_calls_callee existed but not caller. Needed for ON DELETE CASCADE from
-- profiles and for "my outgoing calls" history queries.
CREATE INDEX IF NOT EXISTS idx_calls_caller
  ON calls (caller_id, created_at DESC);

-- ── 3. wallet_transactions: balance snapshot CHECK constraints ────────────────
-- balance_*_after_kobo are ledger snapshots; they must mirror the wallet's own
-- CHECK (available_kobo >= 0 / pending_kobo >= 0). Adding the constraint here
-- gives DB-level defence against any future wallet RPC bug.
ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_tx_balance_available_nonneg
    CHECK (balance_available_after_kobo >= 0);

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_tx_balance_pending_nonneg
    CHECK (balance_pending_after_kobo >= 0);

-- ── 4. messages: idempotency key ─────────────────────────────────────────────
-- Allows clients to attach a stable key so retried sends don't create
-- duplicate messages. NULL means "no dedup requested" (old messages).
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Partial unique index: enforces uniqueness only when key is provided.
-- messages is PARTITION BY RANGE (created_at) so this index lives on the
-- parent and is enforced globally.
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency_key
  ON messages (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── 5. payout_requests: admin status index ───────────────────────────────────
-- Existing filtered index only covers status IN ('pending','review').
-- Admin pages filter by 'processing', 'completed', 'failed' too.
CREATE INDEX IF NOT EXISTS idx_payout_requests_status_created
  ON payout_requests (status, created_at DESC);

-- ── 6. post_comments: author index ───────────────────────────────────────────
-- Moderation queries: "show all active comments by user X".
-- The existing idx_post_comments_post_created covers (post_id, created_at).
CREATE INDEX IF NOT EXISTS idx_post_comments_author_created
  ON post_comments (author_id, created_at DESC)
  WHERE is_deleted = false;

-- ── 7. paystack_webhook_events: explicit service_role-only policy ─────────────
-- RLS was enabled with no policies, meaning authenticated users are denied by
-- Postgres's default-deny. That's the correct intent, but implicit. Make it
-- explicit so a future reader doesn't think the missing policy is a bug.
CREATE POLICY paystack_webhook_events_service_role_only
  ON paystack_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
