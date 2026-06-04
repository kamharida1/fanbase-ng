import { afterEach, describe, expect, it, vi } from "vitest";

import { getEnv, validateProductionEnv } from "@/config/env";

describe("getEnv", () => {
  afterEach(() => {
    vi.stubEnv("NODE_ENV", "test");
  });

  it("returns test defaults in test env", () => {
    const env = getEnv();
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });
});

describe("validateProductionEnv", () => {
  it("skips when not vercel production", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";
    expect(() => validateProductionEnv()).not.toThrow();
    process.env.VERCEL_ENV = prev;
  });
});
