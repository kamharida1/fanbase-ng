import type { PlanBillingInterval } from "@/types/subscription";

const MS_DAY = 86_400_000;

export function addPeriod(
  from: Date,
  interval: PlanBillingInterval,
  trialDays = 0,
): { start: Date; end: Date } {
  const start = new Date(from);

  if (trialDays > 0) {
    const end = new Date(start.getTime() + trialDays * MS_DAY);
    return { start, end };
  }

  if (interval === "free") {
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 100);
    return { start, end };
  }

  if (interval === "annual") {
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return { start, end };
  }

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export function addBundlePeriod(
  from: Date,
  months: number,
): { start: Date; end: Date } {
  const start = new Date(from);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  return { start, end };
}

export function extendPeriod(
  currentEnd: Date | null,
  interval: PlanBillingInterval,
): { start: Date; end: Date } {
  const anchor =
    currentEnd && currentEnd.getTime() > Date.now()
      ? currentEnd
      : new Date();
  return addPeriod(anchor, interval, 0);
}

export const PAST_DUE_GRACE_DAYS = 3;

export function pastDueGraceEnds(periodEnd: Date): Date {
  return new Date(periodEnd.getTime() + PAST_DUE_GRACE_DAYS * MS_DAY);
}

// How long after a subscription ends before we send a "we miss you" reminder.
export const WIN_BACK_DELAY_DAYS = 7;
// Width of the lookback window the daily cron scans, so a missed run on day N
// still catches the subscription on day N+1 (idempotency_key prevents repeats).
export const WIN_BACK_WINDOW_DAYS = 3;
