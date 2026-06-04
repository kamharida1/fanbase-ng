-- Migration: 24 — Row Level Security policies (all tables)
-- Fanbase NG
-- service_role bypasses RLS. Admin/audit/moderation: API + service role only.

-- =============================================================================
-- profiles
-- =============================================================================
CREATE POLICY profiles_select_active ON profiles
  FOR SELECT TO authenticated, anon
  USING (deleted_at IS NULL AND status = 'active');

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- creator_profiles
-- =============================================================================
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

CREATE POLICY creator_profiles_insert_own ON creator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

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
CREATE POLICY subscription_plans_select_active ON subscription_plans
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

CREATE POLICY subscription_plans_insert_own ON subscription_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.user_id = auth.uid())
  );

CREATE POLICY subscription_plans_update_own ON subscription_plans
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY subscription_plans_delete_own ON subscription_plans
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- subscriptions
-- =============================================================================
CREATE POLICY subscriptions_select_participant ON subscriptions
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY subscriptions_insert_fan ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (fan_id = auth.uid());

CREATE POLICY subscriptions_update_participant ON subscriptions
  FOR UPDATE TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid())
  WITH CHECK (fan_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- subscription_events
-- =============================================================================
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
CREATE POLICY payments_select_participant ON payments
  FOR SELECT TO authenticated
  USING (payer_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- disputes
-- =============================================================================
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
CREATE POLICY posts_select_accessible ON posts
  FOR SELECT TO authenticated, anon
  USING (public.can_view_post(auth.uid(), id));

CREATE POLICY posts_insert_own ON posts
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.user_id = auth.uid())
  );

CREATE POLICY posts_update_own ON posts
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY posts_delete_own ON posts
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- post_media
-- =============================================================================
CREATE POLICY post_media_select_accessible ON post_media
  FOR SELECT TO authenticated, anon
  USING (public.can_view_post(auth.uid(), post_id));

CREATE POLICY post_media_insert_own ON post_media
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_media.post_id AND p.creator_id = auth.uid()
    )
  );

CREATE POLICY post_media_update_own ON post_media
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_media.post_id AND p.creator_id = auth.uid()
    )
  );

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
CREATE POLICY post_likes_select ON post_likes
  FOR SELECT TO authenticated
  USING (public.can_view_post(auth.uid(), post_id));

CREATE POLICY post_likes_insert_own ON post_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    fan_id = auth.uid()
    AND public.can_view_post(auth.uid(), post_id)
  );

CREATE POLICY post_likes_delete_own ON post_likes
  FOR DELETE TO authenticated
  USING (fan_id = auth.uid());

-- =============================================================================
-- post_comments
-- =============================================================================
CREATE POLICY post_comments_select ON post_comments
  FOR SELECT TO authenticated
  USING (
    is_deleted = false
    AND public.can_view_post(auth.uid(), post_id)
  );

CREATE POLICY post_comments_insert ON post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_view_post(auth.uid(), post_id)
  );

CREATE POLICY post_comments_update_own ON post_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- =============================================================================
-- post_views
-- =============================================================================
CREATE POLICY post_views_insert ON post_views
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    public.can_view_post(auth.uid(), post_id)
    AND (viewer_id IS NULL OR viewer_id = auth.uid())
  );

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
CREATE POLICY ppv_purchases_select_own ON ppv_purchases
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR EXISTS (
    SELECT 1 FROM posts p
    WHERE p.id = ppv_purchases.post_id AND p.creator_id = auth.uid()
  ));

-- =============================================================================
-- tips
-- =============================================================================
CREATE POLICY tips_select_participant ON tips
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- conversations
-- =============================================================================
CREATE POLICY conversations_select_participant ON conversations
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY conversations_insert_fan ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (fan_id = auth.uid());

CREATE POLICY conversations_update_participant ON conversations
  FOR UPDATE TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- messages
-- =============================================================================
CREATE POLICY messages_select_participant ON messages
  FOR SELECT TO authenticated
  USING (
    is_deleted = false
    AND public.is_conversation_participant(auth.uid(), conversation_id)
  );

CREATE POLICY messages_insert_participant ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(auth.uid(), conversation_id)
  );

CREATE POLICY messages_update_sender ON messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid());

-- =============================================================================
-- message_purchases
-- =============================================================================
CREATE POLICY message_purchases_select_own ON message_purchases
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid());

-- =============================================================================
-- wallets
-- =============================================================================
CREATE POLICY wallets_select_own ON wallets
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- =============================================================================
-- wallet_transactions (read-only for users; writes via service role)
-- =============================================================================
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
CREATE POLICY payout_accounts_select_own ON payout_accounts
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY payout_accounts_insert_own ON payout_accounts
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY payout_accounts_update_own ON payout_accounts
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY payout_accounts_delete_own ON payout_accounts
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- payout_requests
-- =============================================================================
CREATE POLICY payout_requests_select_own ON payout_requests
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY payout_requests_insert_own ON payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- =============================================================================
-- notification_preferences
-- =============================================================================
CREATE POLICY notification_preferences_select_own ON notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notification_preferences_update_own ON notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- notifications
-- =============================================================================
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- reports
-- =============================================================================
CREATE POLICY reports_insert_own ON reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY reports_select_own ON reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- =============================================================================
-- moderation_queue, moderation_actions — service role only
-- =============================================================================

-- =============================================================================
-- user_strikes
-- =============================================================================
CREATE POLICY user_strikes_select_own ON user_strikes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- referral_programs
-- =============================================================================
CREATE POLICY referral_programs_select_active ON referral_programs
  FOR SELECT TO authenticated, anon
  USING (is_active = true AND (ends_at IS NULL OR ends_at > now()));

-- =============================================================================
-- referral_codes
-- =============================================================================
CREATE POLICY referral_codes_select_active ON referral_codes
  FOR SELECT TO authenticated, anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY referral_codes_insert_own ON referral_codes
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY referral_codes_update_own ON referral_codes
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- =============================================================================
-- referrals
-- =============================================================================
CREATE POLICY referrals_select_participant ON referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());

-- =============================================================================
-- referral_rewards
-- =============================================================================
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

CREATE POLICY earnings_daily_select_own ON earnings_daily
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- user_sessions
-- =============================================================================
CREATE POLICY user_sessions_select_own ON user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_sessions_insert_own ON user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_sessions_update_own ON user_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_sessions_delete_own ON user_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
