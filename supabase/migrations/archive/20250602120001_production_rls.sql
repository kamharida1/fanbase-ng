-- =============================================================================
-- Fanbase NG — Row Level Security (run after 20250602120000_production_schema.sql)
-- =============================================================================

-- Enable RLS on all user-facing tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppv_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Admin tables: no public access (service role / admin API only)
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_programs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
CREATE POLICY profiles_select_public_fields ON profiles
  FOR SELECT TO authenticated, anon
  USING (
    deleted_at IS NULL
    AND status = 'active'
  );

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- Creator profiles
-- -----------------------------------------------------------------------------
CREATE POLICY creator_profiles_select_active ON creator_profiles
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = creator_profiles.user_id
        AND p.deleted_at IS NULL
        AND p.status = 'active'
    )
  );

CREATE POLICY creator_profiles_update_own ON creator_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY creator_profiles_insert_own ON creator_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Subscription plans & subscriptions
-- -----------------------------------------------------------------------------
CREATE POLICY subscription_plans_select ON subscription_plans
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

CREATE POLICY subscription_plans_manage_own ON subscription_plans
  FOR ALL TO authenticated
  USING (
    creator_id = auth.uid()
    AND EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.user_id = auth.uid())
  )
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY subscriptions_select_participant ON subscriptions
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY subscriptions_insert_fan ON subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (fan_id = auth.uid());

CREATE POLICY subscriptions_update_participant ON subscriptions
  FOR UPDATE TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Posts & engagement (access gating completed in API; base policies here)
-- -----------------------------------------------------------------------------
CREATE POLICY posts_select_published ON posts
  FOR SELECT TO authenticated, anon
  USING (
    status = 'published'
    AND removed_at IS NULL
    AND moderation_status = 'approved'
  );

CREATE POLICY posts_manage_own ON posts
  FOR ALL TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY post_media_select ON post_media
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_media.post_id
        AND p.status = 'published'
        AND p.moderation_status = 'approved'
    )
  );

CREATE POLICY post_likes_manage ON post_likes
  FOR ALL TO authenticated
  USING (fan_id = auth.uid())
  WITH CHECK (fan_id = auth.uid());

CREATE POLICY post_comments_select ON post_comments
  FOR SELECT TO authenticated
  USING (is_deleted = false);

CREATE POLICY post_comments_insert ON post_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Messaging
-- -----------------------------------------------------------------------------
CREATE POLICY conversations_select_participant ON conversations
  FOR SELECT TO authenticated
  USING (fan_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY conversations_insert_fan ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (fan_id = auth.uid());

CREATE POLICY messages_select_participant ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.fan_id = auth.uid() OR c.creator_id = auth.uid())
    )
    AND is_deleted = false
  );

CREATE POLICY messages_insert_participant ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.fan_id = auth.uid() OR c.creator_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- Payments & wallets
-- -----------------------------------------------------------------------------
CREATE POLICY payments_select_own ON payments
  FOR SELECT TO authenticated
  USING (payer_id = auth.uid() OR creator_id = auth.uid());

CREATE POLICY wallets_select_own ON wallets
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY wallet_transactions_select_own ON wallet_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallets w
      WHERE w.id = wallet_transactions.wallet_id
        AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY payout_accounts_manage_own ON payout_accounts
  FOR ALL TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY payout_requests_select_own ON payout_requests
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY payout_requests_insert_own ON payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Notifications & reports
-- -----------------------------------------------------------------------------
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_preferences_manage_own ON notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY reports_insert_authenticated ON reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY reports_select_own ON reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Referrals
-- -----------------------------------------------------------------------------
CREATE POLICY referral_codes_select ON referral_codes
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

CREATE POLICY referral_codes_manage_own ON referral_codes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY referrals_select_participant ON referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid());

-- -----------------------------------------------------------------------------
-- User sessions
-- -----------------------------------------------------------------------------
CREATE POLICY user_sessions_manage_own ON user_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypasses RLS. Admin/moderation/audit: no policies for authenticated;
-- use Edge Functions or API routes with service role + admin JWT verification.
