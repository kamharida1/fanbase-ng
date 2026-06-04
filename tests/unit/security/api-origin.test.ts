import { describe, expect, it } from "vitest";

import { verifyApiMutationOrigin } from "@/lib/security/api-origin";
import { withNodeEnv } from "../../helpers/env";

describe("verifyApiMutationOrigin", () => {
  it("allows GET without origin", () => {
    const req = new Request("http://localhost:3000/api/v1/feed", {
      method: "GET",
    });
    expect(verifyApiMutationOrigin(req)).toBe(true);
  });

  it("allows POST with matching origin", () => {
    const req = new Request("http://localhost:3000/api/v1/media/presign", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    expect(verifyApiMutationOrigin(req)).toBe(true);
  });

  it("rejects POST with foreign origin in production", () => {
    withNodeEnv("production", () => {
      const req = new Request("http://localhost:3000/api/v1/media/presign", {
        method: "POST",
        headers: { origin: "https://evil.example" },
      });
      expect(verifyApiMutationOrigin(req)).toBe(false);
    });
  });

  it("allows same-origin via sec-fetch-site without Origin", () => {
    withNodeEnv("production", () => {
      const req = new Request("http://localhost:3000/api/v1/media/presign", {
        method: "POST",
        headers: { "sec-fetch-site": "same-origin" },
      });
      expect(verifyApiMutationOrigin(req)).toBe(true);
    });
  });
});
