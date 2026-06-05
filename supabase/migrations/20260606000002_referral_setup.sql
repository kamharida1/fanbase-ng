-- ── Seed default referral program ─────────────────────────────────────────
-- 5% reward (500 bps) to the referrer when the referee's first payment
-- qualifies. No referee discount for now.
INSERT INTO referral_programs (slug, name, referrer_reward_bps, referee_discount_bps, is_active)
VALUES ('default', 'Fanbase NG Referral Program', 500, 0, true)
ON CONFLICT (slug) DO NOTHING;

-- ── RLS on referral tables ─────────────────────────────────────────────────
ALTER TABLE referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards  ENABLE ROW LEVEL SECURITY;

-- referral_programs: everyone can read active programs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referral_programs' AND policyname='referral_programs_public_read') THEN
    EXECUTE 'CREATE POLICY referral_programs_public_read ON referral_programs FOR SELECT TO authenticated USING (is_active = true)';
  END IF;
END $$;

-- referral_codes: owners manage their own codes; anyone can look up a code
-- by its value (needed at signup to identify the referrer)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referral_codes' AND policyname='referral_codes_owner') THEN
    EXECUTE 'CREATE POLICY referral_codes_owner ON referral_codes FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referral_codes' AND policyname='referral_codes_lookup') THEN
    EXECUTE 'CREATE POLICY referral_codes_lookup ON referral_codes FOR SELECT TO authenticated USING (is_active = true)';
  END IF;
END $$;

-- referrals: referrers can see referrals they made; referees can see their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referrals' AND policyname='referrals_participants') THEN
    EXECUTE 'CREATE POLICY referrals_participants ON referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referee_id = auth.uid())';
  END IF;
END $$;

-- referral_rewards: referrers can see their rewards
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='referral_rewards' AND policyname='referral_rewards_referrer') THEN
    EXECUTE 'CREATE POLICY referral_rewards_referrer ON referral_rewards FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM referrals r WHERE r.id = referral_id AND r.referrer_id = auth.uid()))';
  END IF;
END $$;
