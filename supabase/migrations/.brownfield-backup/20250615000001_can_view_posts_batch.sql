-- Batch post visibility for feed enrichment (avoids N can_view_post RPCs)

CREATE OR REPLACE FUNCTION public.can_view_posts(
  p_user_id UUID,
  p_post_ids UUID[]
)
RETURNS TABLE(post_id UUID, can_view BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pid AS post_id, public.can_view_post(p_user_id, pid) AS can_view
  FROM unnest(p_post_ids) AS pid;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_posts(UUID, UUID[]) TO authenticated, anon;
