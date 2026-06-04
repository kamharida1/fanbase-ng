import { describe, expect, it } from "vitest";

import {
  REQUEST_ID_HEADER,
  createRequestId,
  requestIdFromHeaders,
} from "@/lib/request-id";

describe("request id", () => {
  it("creates a UUID", () => {
    expect(createRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("reads header when present", () => {
    const req = new Request("http://localhost", {
      headers: { [REQUEST_ID_HEADER]: "abc-123" },
    });
    expect(requestIdFromHeaders(req)).toBe("abc-123");
  });

  it("generates id when header missing", () => {
    const req = new Request("http://localhost");
    expect(requestIdFromHeaders(req)).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
