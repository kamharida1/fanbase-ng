import { describe, expect, it } from "vitest";

import { formatAdminDate, formatAdminMoney } from "@/lib/admin/format";

describe("admin format", () => {
  it("formats money from kobo", () => {
    expect(formatAdminMoney(100_000)).toContain("1");
  });

  it("formats null date as em dash", () => {
    expect(formatAdminDate(null)).toBe("—");
  });

  it("formats ISO date", () => {
    expect(formatAdminDate("2026-06-01T10:00:00Z")).toMatch(/2026/);
  });
});
