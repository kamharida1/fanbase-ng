-- Record which audience segment a broadcast targeted, for display in history.
ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS audience_label TEXT;
