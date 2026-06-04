-- Migration: 19 — BRIN indexes for time-series scale
-- Fanbase NG

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_brin ON audit_logs USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_brin ON wallet_transactions USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_created_brin ON messages USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_brin ON notifications USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_post_views_created_brin ON post_views USING BRIN (created_at);
