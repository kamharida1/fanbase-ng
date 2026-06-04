import { describe, expect, it } from "vitest";

import { apiError, apiOk } from "@/lib/api/response";

describe("api response optional fields", () => {
  it("apiOk without requestId", async () => {
    const res = apiOk({ x: 1 });
    expect(res.headers.get("x-request-id")).toBeNull();
  });

  it("apiError without retry", async () => {
    const res = apiError("Bad", 400);
    expect(res.headers.get("Retry-After")).toBeNull();
  });
});
