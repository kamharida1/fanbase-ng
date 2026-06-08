-- Weekly email digest preferences: opt-in flag plus a timestamp so the
-- digest cron can pick exactly the users due for a fresh send (and never
-- double-send if the cron is retried).
alter table notification_preferences
  add column if not exists digest_enabled boolean not null default true,
  add column if not exists last_digest_sent_at timestamptz;
