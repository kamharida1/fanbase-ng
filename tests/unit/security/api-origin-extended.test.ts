import { afterEach, describe, expect, it } from "vitest";

import { verifyApiMutationOrigin } from "@/lib/security/api-origin";

describe("verifyApiMutationOrigin vercel", () => {
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;
  const prevVercel = process.env.VERCEL_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
    process.env.VERCEL_URL = prevVercel;
  });

  it("allows vercel preview origin when VERCEL_URL set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL_URL = "my-app.vercel.app";
    const req = new Request("https://my-app.vercel.app/api/v1/x", {
      method: "POST",
      headers: { origin: "https://my-app.vercel.app" },
    });
    expect(verifyApiMutationOrigin(req)).toBe(true);
  });
});
