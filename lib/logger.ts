type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function serialize(level: LogLevel, msg: string, fields?: LogFields): string {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  });
}

export function log(
  level: LogLevel,
  msg: string,
  fields?: LogFields,
): void {
  const line = serialize(level, msg, fields);
  if (level === "error") {
    console.error(line);
    if (fields?.err instanceof Error) {
      void import("@/lib/observability/sentry").then(({ captureException }) =>
        captureException(fields.err, { msg, ...fields }),
      );
    } else if (typeof fields?.err === "string") {
      void import("@/lib/observability/sentry").then(({ captureException }) =>
        captureException(new Error(fields.err as string), { msg, ...fields }),
      );
    }
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  if (process.env.NODE_ENV === "production" && level === "debug") {
    return;
  }
  console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => log("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => log("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => log("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => log("error", msg, fields),
};
