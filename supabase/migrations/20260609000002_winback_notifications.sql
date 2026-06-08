-- Add notification type for win-back reminders sent to lapsed subscribers.
alter type notification_type add value if not exists 'resubscribe_reminder';
