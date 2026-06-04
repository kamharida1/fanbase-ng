-- Migration: 02 — Enum types
-- Fanbase NG
-- Idempotent: safe to re-run on dev when types already exist.

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('fan', 'creator', 'admin', 'moderator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM (
    'active', 'suspended', 'banned', 'pending_verification', 'deleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'trialing', 'active', 'past_due', 'cancelled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE post_visibility AS ENUM ('public', 'subscribers', 'tier', 'ppv');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE post_status AS ENUM (
    'draft', 'processing', 'published', 'archived', 'removed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE post_media_type AS ENUM ('image', 'video', 'audio', 'document');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_processing_status AS ENUM (
    'uploading', 'processing', 'ready', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE moderation_status AS ENUM (
    'pending', 'approved', 'flagged', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending', 'success', 'failed', 'refunded', 'disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM (
    'subscription', 'ppv', 'tip', 'message_ppv', 'wallet_topup', 'referral_bonus'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_owner_type AS ENUM ('fan', 'creator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_tx_type AS ENUM (
    'subscription_credit',
    'ppv_credit',
    'tip_credit',
    'message_ppv_credit',
    'platform_fee_debit',
    'payment_fee_debit',
    'refund_debit',
    'payout_debit',
    'clearance_credit',
    'referral_credit',
    'adjustment_credit',
    'adjustment_debit',
    'topup_credit'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_account_type AS ENUM ('bank_account', 'mobile_money');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_request_status AS ENUM (
    'pending', 'review', 'processing', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM (
    'spam', 'harassment', 'underage', 'illegal', 'copyright', 'impersonation', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE moderation_action_type AS ENUM (
    'approve', 'reject', 'remove', 'warn', 'strike', 'ban', 'restore'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'push', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'read');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE referral_status AS ENUM (
    'pending', 'qualified', 'rewarded', 'expired', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM ('open', 'won', 'lost', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
