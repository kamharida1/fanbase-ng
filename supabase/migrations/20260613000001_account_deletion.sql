-- Migration: Self-service account deletion
-- Adds a grace-period deletion request to profiles, finalized by a daily cron.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_deletion_due
  ON profiles (deletion_scheduled_for)
  WHERE deletion_scheduled_for IS NOT NULL AND deleted_at IS NULL;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_deletion';
