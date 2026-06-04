import { describe, expect, it } from "vitest";

import {
  postgrestIlikePattern,
  sanitizePostgrestIlikeTerm,
} from "@/lib/security/postgrest-search";

describe("sanitizePostgrestIlikeTerm", () => {
  it("strips filter-breaking characters", () => {
    expect(sanitizePostgrestIlikeTerm("foo,bar%_")).toBe("foobar");
  });

  it("returns null for empty after sanitize", () => {
    expect(sanitizePostgrestIlikeTerm("%%%")).toBeNull();
  });

  it("truncates long input", () => {
    const long = "a".repeat(200);
    expect(sanitizePostgrestIlikeTerm(long)?.length).toBeLessThanOrEqual(80);
  });
});

describe("postgrestIlikePattern", () => {
  it("wraps safe term", () => {
    expect(postgrestIlikePattern("jane")).toBe("%jane%");
  });

  it("returns wildcard for invalid term", () => {
    expect(postgrestIlikePattern("!!!")).toBe("%");
  });
});
