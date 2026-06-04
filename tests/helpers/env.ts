import { vi } from "vitest";

/** Temporarily override NODE_ENV (read-only in TS without this). */
export function withNodeEnv<T>(value: string, fn: () => T): T {
  vi.stubEnv("NODE_ENV", value);
  try {
    return fn();
  } finally {
    vi.unstubAllEnvs();
  }
}
