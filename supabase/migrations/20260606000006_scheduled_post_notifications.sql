-- Add new_post notification type and update publish_due_scheduled_posts to return post IDs

do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from   pg_constraint c
  join   pg_class t on t.oid = c.conrelid
  where  t.relname = 'notifications'
    and  c.contype = 'c'
    and  pg_get_constraintdef(c.oid) like '%type%';

  if v_constraint is not null then
    execute format('alter table notifications drop constraint %I', v_constraint);
  end if;

  alter table notifications add constraint notifications_type_check
    check (type in (
      'new_subscriber',
      'new_message',
      'new_comment',
      'new_like',
      'new_payout',
      'creator_live',
      'new_post'
    ));
end $$;

-- Replace publish_due_scheduled_posts to return published post rows
-- so the cron job can fan-out notifications to subscribers.
-- Must drop first because return type changes (was INTEGER, now TABLE).
DROP FUNCTION IF EXISTS public.publish_due_scheduled_posts();
CREATE OR REPLACE FUNCTION public.publish_due_scheduled_posts()
RETURNS TABLE (post_id UUID, creator_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, creator_id AS cid
    FROM posts
    WHERE status = 'draft'
      AND scheduled_publish_at IS NOT NULL
      AND scheduled_publish_at <= now()
      AND removed_at IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE posts
    SET
      status = 'published',
      published_at = scheduled_publish_at,
      moderation_status = 'approved',
      updated_at = now()
    WHERE id = r.id;

    post_id    := r.id;
    creator_id := r.cid;
    RETURN NEXT;
  END LOOP;
END;
$$;
