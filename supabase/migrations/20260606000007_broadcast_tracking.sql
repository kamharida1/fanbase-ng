-- Broadcast delivery tracking

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body              TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_ppv            BOOLEAN NOT NULL DEFAULT false,
  ppv_price_kobo    INTEGER,
  total_recipients  INTEGER NOT NULL DEFAULT 0,
  sent_count        INTEGER NOT NULL DEFAULT 0,
  failed_count      INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'sending'
                      CHECK (status IN ('sending', 'completed', 'partial', 'failed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS broadcasts_creator_id_created_at_idx
  ON public.broadcasts (creator_id, created_at DESC);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- Creator can read their own broadcasts
CREATE POLICY "creator_read_own_broadcasts"
  ON public.broadcasts FOR SELECT
  USING (creator_id = auth.uid());

-- Only service role inserts/updates (via admin client in server action)
