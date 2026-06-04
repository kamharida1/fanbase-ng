import { describe, expect, it, vi } from "vitest";

describe("captureException", () => {
  it("no-ops without SENTRY_DSN", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const { captureException } = await import("@/lib/observability/sentry");
    expect(() => captureException(new Error("test"))).not.toThrow();
    vi.unstubAllEnvs();
  });
});
