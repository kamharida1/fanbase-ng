export const ACCOUNT_DELETION_GRACE_DAYS = 14;

const MS_DAY = 86_400_000;

export function accountDeletionScheduledFor(from: Date = new Date()): Date {
  return new Date(from.getTime() + ACCOUNT_DELETION_GRACE_DAYS * MS_DAY);
}
