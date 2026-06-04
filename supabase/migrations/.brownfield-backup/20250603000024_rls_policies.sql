-- Migration: 24 — Row Level Security policies (all tables)
-- Fanbase NG
-- service_role bypasses RLS. Admin/audit/moderation: API + service role only.
-- Brownfield: DROP POLICY IF EXISTS before each CREATE (PrivyChat may have overlapping names).

-- =============================================================================
-- profiles
-- =============================================================================
DROP POLICY IF EXISTS profiles_select_active ON profiles;
CREATE POLICY profiles_select_active ON profiles
  FOR SELECT TO authenticated, anon
  USING (deleted_at IS NULL AND status = 'active');

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- creator_profiles
-- =============================================================================
DROP POLICY IF EXISTS creator_profiles_select ON creator_profiles;
CREATE POLICY creator_profiles_select ON creator_profiles
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = creator_profiles.user_id
        AND p.deleted_at IS NULL
        AND p.status = 'active'
    )
  );

DROP POLICY IF EXISTS creator_profiles_insert_own ON creator_profiles;
CREATE POLICY creator_profiles_insert_own ON creator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS creator_profiles_update_own ON creator_profiles;
CREATE POLICY creator_profiles_update_own ON creator_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- admin_roles, admin_users — no authenticated policies (service role only)
-- =============================================================================

-- =============================================================================
-- subscription_plans
-- =============================================================================
DROP POLICY IF EXISTS subscription_plans_select_active ON subscription_plans;
CREATE POLICY subscription_plans_select_active ON subscription_plans
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS subscription_plans_insert_own ON subscription_plans;
CREATE POLICY subscription_plans_insert_own ON subscription_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS subscription_plans_update_own ON subscription_plans;
CREATE POLICY subscription_plans_update_own ON subscription_plans
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS subscription_plans_delete_own ON subscription_plans;
CREATE POLICY subscription_plans_delete_own ON subscription_plans
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- subscriptions
-- =============================================================================
DROP POLICY IF EXISTS subscriptions_select_participant ON subscriptions;
CREATE POLICY subscriptions_select_participant ON subscriptions
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_insert_fan ON subscriptions;
CREATE POLICY subscriptions_insert_fan ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (fan_id = auth.uid());

DROP POLICY IF EXISTS subscriptions_update_participant ON subscriptions;
CREATE POLICY subscriptions_update_participant ON subscriptions
  FOR UPDATE TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid())
  WITH CHECK (fan_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- subscription_events
-- =============================================================================
DROP POLICY IF EXISTS subscription_events_select_participant ON subscription_events;
CREATE POLICY subscription_events_select_participant ON subscription_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.id = subscription_events.subscription_id
        AND (s.fan_id = auth.uid() OR s.creator_id = auth.uid())
    )
  );

-- =============================================================================
-- payments
-- =============================================================================
DROP POLICY IF EXISTS payments_select_participant ON payments;
CREATE POLICY payments_select_participant ON payments
  FOR SELECT TO authenticated
  USING (payer_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- disputes
-- =============================================================================
DROP POLICY IF EXISTS disputes_select_participant ON disputes;
CREATE POLICY disputes_select_participant ON disputes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments p
      WHERE p.id = disputes.payment_id
        AND (p.payer_id = auth.uid() OR p.creator_id = auth.uid())
    )
  );

-- =============================================================================
-- posts
-- =============================================================================
DROP POLICY IF EXISTS posts_select_accessible ON posts;
CREATE POLICY posts_select_accessible ON posts
  FOR SELECT TO authenticated, anon
  USING (public.can_view_post(auth.uid(), id));

DROP POLICY IF EXISTS posts_insert_own ON posts;
CREATE POLICY posts_insert_own ON posts
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS posts_update_own ON posts;
CREATE POLICY posts_update_own ON posts
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS posts_delete_own ON posts;
CREATE POLICY posts_delete_own ON posts
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- post_media
-- =============================================================================
DROP POLICY IF EXISTS post_media_select_accessible ON post_media;
CREATE POLICY post_media_select_accessible ON post_media
  FOR SELECT TO authenticated, anon
  USING (public.can_view_post(auth.uid(), post_id));

DROP POLICY IF EXISTS post_media_insert_own ON post_media;
CREATE POLICY post_media_insert_own ON post_media
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_media.post_id AND p.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS post_media_update_own ON post_media;
CREATE POLICY post_media_update_own ON post_media
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_media.post_id AND p.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS post_media_delete_own ON post_media;
CREATE POLICY post_media_delete_own ON post_media
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_media.post_id AND p.creator_id = auth.uid()
    )
  );

-- =============================================================================
-- post_likes
-- =============================================================================
DROP POLICY IF EXISTS post_likes_select ON post_likes;
CREATE POLICY post_likes_select ON post_likes
  FOR SELECT TO authenticated
  USING (public.can_view_post(auth.uid(), post_id));

DROP POLICY IF EXISTS post_likes_insert_own ON post_likes;
CREATE POLICY post_likes_insert_own ON post_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    fan_id = auth.uid()
    AND public.can_view_post(auth.uid(), post_id)
  );

DROP POLICY IF EXISTS post_likes_delete_own ON post_likes;
CREATE POLICY post_likes_delete_own ON post_likes
  FOR DELETE TO authenticated
  USING (fan_id = auth.uid());

-- =============================================================================
-- post_comments
-- =============================================================================
DROP POLICY IF EXISTS post_comments_select ON post_comments;
CREATE POLICY post_comments_select ON post_comments
  FOR SELECT TO authenticated
  USING (
    is_deleted = false
    AND public.can_view_post(auth.uid(), post_id)
  );

DROP POLICY IF EXISTS post_comments_insert ON post_comments;
CREATE POLICY post_comments_insert ON post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_view_post(auth.uid(), post_id)
  );

DROP POLICY IF EXISTS post_comments_update_own ON post_comments;
CREATE POLICY post_comments_update_own ON post_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- =============================================================================
-- post_views
-- =============================================================================
DROP POLICY IF EXISTS post_views_insert ON post_views;
CREATE POLICY post_views_insert ON post_views
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    public.can_view_post(auth.uid(), post_id)
    AND (viewer_id IS NULL OR viewer_id = auth.uid())
  );

DROP POLICY IF EXISTS post_views_select_creator ON post_views;
CREATE POLICY post_views_select_creator ON post_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_views.post_id AND p.creator_id = auth.uid()
    )
  );

-- =============================================================================
-- ppv_purchases
-- =============================================================================
DROP POLICY IF EXISTS ppv_purchases_select_own ON ppv_purchases;
CREATE POLICY ppv_purchases_select_own ON ppv_purchases
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR EXISTS (
    SELECT 1 FROM posts p
    WHERE p.id = ppv_purchases.post_id AND p.creator_id = auth.uid()
  ));

-- =============================================================================
-- tips
-- =============================================================================
DROP POLICY IF EXISTS tips_select_participant ON tips;
CREATE POLICY tips_select_participant ON tips
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- conversations
-- =============================================================================
DROP POLICY IF EXISTS conversations_select_participant ON conversations;
CREATE POLICY conversations_select_participant ON conversations
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

DROP POLICY IF EXISTS conversations_insert_fan ON conversations;
CREATE POLICY conversations_insert_fan ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (fan_id = auth.uid());

DROP POLICY IF EXISTS conversations_update_participant ON conversations;
CREATE POLICY conversations_update_participant ON conversations
  FOR UPDATE TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- messages
-- =============================================================================
DROP POLICY IF EXISTS messages_select_participant ON messages;
CREATE POLICY messages_select_participant ON messages
  FOR SELECT TO authenticated
  USING (
    is_deleted = false
    AND public.is_conversation_participant(auth.uid(), conversation_id)
  );

DROP POLICY IF EXISTS messages_insert_participant ON messages;
CREATE POLICY messages_insert_participant ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(auth.uid(), conversation_id)
  );

DROP POLICY IF EXISTS messages_update_sender ON messages;
CREATE POLICY messages_update_sender ON messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

-- =============================================================================
-- message_purchases
-- =============================================================================
DROP POLICY IF EXISTS message_purchases_select_own ON message_purchases;
CREATE POLICY message_purchases_select_own ON message_purchases
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid());

-- =============================================================================
-- wallets
-- =============================================================================
DROP POLICY IF EXISTS wallets_select_own ON wallets;
CREATE POLICY wallets_select_own ON wallets
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- =============================================================================
-- wallet_transactions (read-only for users; writes via service role)
-- =============================================================================
DROP POLICY IF EXISTS wallet_transactions_select_own ON wallet_transactions;
CREATE POLICY wallet_transactions_select_own ON wallet_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallets w
      WHERE w.id = wallet_transactions.wallet_id
        AND w.owner_id = auth.uid()
    )
  );

-- =============================================================================
-- payout_accounts
-- =============================================================================
DROP POLICY IF EXISTS payout_accounts_select_own ON payout_accounts;
CREATE POLICY payout_accounts_select_own ON payout_accounts
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS payout_accounts_insert_own ON payout_accounts;
CREATE POLICY payout_accounts_insert_own ON payout_accounts
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS payout_accounts_update_own ON payout_accounts;
CREATE POLICY payout_accounts_update_own ON payout_accounts
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS payout_accounts_delete_own ON payout_accounts;
CREATE POLICY payout_accounts_delete_own ON payout_accounts
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- payout_requests
-- =============================================================================
DROP POLICY IF EXISTS payout_requests_select_own ON payout_requests;
CREATE POLICY payout_requests_select_own ON payout_requests
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

DROP POLICY IF EXISTS payout_requests_insert_own ON payout_requests;
CREATE POLICY payout_requests_insert_own ON payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- =============================================================================
-- notification_preferences
-- =============================================================================
DROP POLICY IF EXISTS notification_preferences_select_own ON notification_preferences;
CREATE POLICY notification_preferences_select_own ON notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_preferences_update_own ON notification_preferences;
CREATE POLICY notification_preferences_update_own ON notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- notifications
-- =============================================================================
DROP POLICY IF EXISTS notifications_select_own ON notifications;
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON notifications;
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- reports
-- =============================================================================
DROP POLICY IF EXISTS reports_insert_own ON reports;
CREATE POLICY reports_insert_own ON reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS reports_select_own ON reports;
CREATE POLICY reports_select_own ON reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- =============================================================================
-- moderation_queue, moderation_actions — service role only
-- =============================================================================

-- =============================================================================
-- user_strikes
-- =============================================================================
DROP POLICY IF EXISTS user_strikes_select_own ON user_strikes;
CREATE POLICY user_strikes_select_own ON user_strikes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- referral_* brownfield (migration 16 may have run against legacy referrals)
-- =============================================================================
DO $referral_rls_brownfield$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'referral_codes'
  ) THEN
    ALTER TABLE public.referral_codes ADD COLUMN IF NOT EXISTS owner_id UUID;
    ALTER TABLE public.referral_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE public.referral_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'referrals'
  ) THEN
    ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_id UUID;
    ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referee_id UUID;
    ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS status referral_status NOT NULL DEFAULT 'pending';
    ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS program_id UUID;
    ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referral_code_id UUID;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'referred_user_id'
    ) THEN
      UPDATE public.referrals SET referee_id = referred_user_id WHERE referee_id IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'referred_id'
    ) THEN
      UPDATE public.referrals SET referee_id = referred_id WHERE referee_id IS NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'invitee_id'
    ) THEN
      UPDATE public.referrals SET referee_id = invitee_id WHERE referee_id IS NULL;
    END IF;
  END IF;
END $referral_rls_brownfield$;

-- =============================================================================
-- referral_programs
-- =============================================================================
DROP POLICY IF EXISTS referral_programs_select_active ON referral_programs;
CREATE POLICY referral_programs_select_active ON referral_programs
  FOR SELECT TO authenticated, anon
  USING (is_active = true AND (ends_at IS NULL OR ends_at > now()));

-- =============================================================================
-- referral_codes
-- =============================================================================
DROP POLICY IF EXISTS referral_codes_select_active ON referral_codes;
CREATE POLICY referral_codes_select_active ON referral_codes
  FOR SELECT TO authenticated, anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS referral_codes_insert_own ON referral_codes;
CREATE POLICY referral_codes_insert_own ON referral_codes
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS referral_codes_update_own ON referral_codes;
CREATE POLICY referral_codes_update_own ON referral_codes
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- =============================================================================
-- referrals
-- =============================================================================
DROP POLICY IF EXISTS referrals_select_participant ON referrals;
CREATE POLICY referrals_select_participant ON referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());

-- =============================================================================
-- referral_rewards
-- =============================================================================
DROP POLICY IF EXISTS referral_rewards_select_participant ON referral_rewards;
CREATE POLICY referral_rewards_select_participant ON referral_rewards
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.id = referral_rewards.referral_id
        AND (r.referrer_id = auth.uid() OR r.referee_id = auth.uid())
    )
  );

-- =============================================================================
-- audit_logs, earnings_daily — service role / admin API only
-- =============================================================================

DROP POLICY IF EXISTS earnings_daily_select_own ON earnings_daily;
CREATE POLICY earnings_daily_select_own ON earnings_daily
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- user_sessions
-- =============================================================================
DROP POLICY IF EXISTS user_sessions_select_own ON user_sessions;
CREATE POLICY user_sessions_select_own ON user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_sessions_insert_own ON user_sessions;
CREATE POLICY user_sessions_insert_own ON user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_sessions_update_own ON user_sessions;
CREATE POLICY user_sessions_update_own ON user_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_sessions_delete_own ON user_sessions;
CREATE POLICY user_sessions_delete_own ON user_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
