-- Add notification types for renewal payment failure (dunning) and
-- subscription expiry due to non-payment.
alter type notification_type add value if not exists 'payment_failed';
alter type notification_type add value if not exists 'subscription_ended';
