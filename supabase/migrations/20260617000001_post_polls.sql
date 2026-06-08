-- Migration: Post polls (creator-attached polls with fan voting)
-- Fanbase NG

CREATE TABLE post_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_id)
);

CREATE INDEX idx_poll_options_poll_id ON poll_options (poll_id);
CREATE INDEX idx_poll_votes_poll_id ON poll_votes (poll_id);
CREATE INDEX idx_poll_votes_option_id ON poll_votes (option_id);

ALTER TABLE post_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- post_polls: visible to anyone who can fully view the underlying post;
-- only the creator can attach a poll to their own post
CREATE POLICY post_polls_select ON post_polls
  FOR SELECT TO authenticated
  USING (public.can_view_post(auth.uid(), post_id));

CREATE POLICY post_polls_insert_own ON post_polls
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_id AND p.creator_id = auth.uid()
    )
  );

-- poll_options: same visibility as the parent poll; creator-only insert
CREATE POLICY poll_options_select ON poll_options
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM post_polls pp
      WHERE pp.id = poll_options.poll_id
        AND public.can_view_post(auth.uid(), pp.post_id)
    )
  );

CREATE POLICY poll_options_insert_own ON poll_options
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM post_polls pp
      JOIN posts p ON p.id = pp.post_id
      WHERE pp.id = poll_options.poll_id AND p.creator_id = auth.uid()
    )
  );

-- poll_votes: voters can only see their own ballot (aggregated counts are
-- exposed separately via get_poll_results, which keeps individual choices
-- private while still allowing public-ish result displays)
CREATE POLICY poll_votes_select_own ON poll_votes
  FOR SELECT TO authenticated
  USING (voter_id = auth.uid());

CREATE POLICY poll_votes_insert_own ON poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    voter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM post_polls pp
      WHERE pp.id = poll_votes.poll_id
        AND (pp.closes_at IS NULL OR pp.closes_at > now())
        AND public.can_view_post(auth.uid(), pp.post_id)
    )
    AND EXISTS (
      SELECT 1 FROM poll_options po
      WHERE po.id = poll_votes.option_id AND po.poll_id = poll_votes.poll_id
    )
  );

-- Aggregated vote counts for a batch of polls, gated by the same visibility
-- rule as the poll itself — keeps individual ballots private (RLS on
-- poll_votes only exposes the caller's own row) while letting everyone who
-- can view the post see the tally.
CREATE OR REPLACE FUNCTION public.get_poll_results(
  p_poll_ids UUID[]
)
RETURNS TABLE (
  poll_id UUID,
  option_id UUID,
  vote_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT po.poll_id, po.id AS option_id, COUNT(pv.id) AS vote_count
  FROM poll_options po
  JOIN post_polls pp ON pp.id = po.poll_id
  LEFT JOIN poll_votes pv ON pv.option_id = po.id
  WHERE po.poll_id = ANY(p_poll_ids)
    AND public.can_view_post(auth.uid(), pp.post_id)
  GROUP BY po.poll_id, po.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_poll_results(UUID[]) TO authenticated, service_role;
