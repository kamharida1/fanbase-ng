-- Add 'paused' status and paused_at column to subscriptions

ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'paused';

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
