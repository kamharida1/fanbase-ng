import * as Sentry from "@sentry/nextjs";

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(error, {
    extra: context,
  });
}
