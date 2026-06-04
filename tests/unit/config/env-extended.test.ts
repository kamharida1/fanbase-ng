import { afterEach, describe, expect, it, vi } from "vitest";

describe("getEnv production parse", () => {
  afterEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
  });

  it("throws when required public env missing in non-test mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { getEnv } = await import("@/config/env");
    expect(() => getEnv()).toThrow(/Invalid environment/);
  });
});

describe("validateProductionEnv strict", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
  });

  it("throws when production secrets missing on Vercel", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    delete process.env.CRON_SECRET;
    const { validateProductionEnv } = await import("@/config/env");
    expect(() => validateProductionEnv()).toThrow(/missing required env/);
  });
});
