import { describe, expect, it } from "vitest";

import {
  formatNgnFromKobo,
  normalizeSocialLinks,
} from "@/lib/creators/format";

describe("formatNgnFromKobo", () => {
  it("formats naira", () => {
    expect(formatNgnFromKobo(100_000)).toContain("1");
    expect(formatNgnFromKobo(100_000)).toMatch(/NGN|₦/);
  });
});

describe("normalizeSocialLinks", () => {
  it("keeps string values only", () => {
    expect(
      normalizeSocialLinks({
        twitter: " https://x.com/a ",
        empty: "  ",
        bad: 1,
      }),
    ).toEqual({ twitter: "https://x.com/a" });
  });

  it("returns empty for invalid input", () => {
    expect(normalizeSocialLinks(null)).toEqual({});
  });
});
