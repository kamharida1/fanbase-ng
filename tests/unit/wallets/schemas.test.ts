import { describe, expect, it } from "vitest";

import {
  addPayoutAccountSchema,
  ngnToKobo,
  validateWithdrawalAmountKobo,
} from "@/lib/wallets/schemas";

describe("wallet schemas", () => {
  it("validates Nigerian account number", () => {
    expect(
      addPayoutAccountSchema.safeParse({
        bank_code: "058",
        bank_name: "GTBank",
        account_number: "0123456789",
        account_name: "Test User",
        set_default: true,
      }).success,
    ).toBe(true);
  });

  it("rejects short account number", () => {
    expect(
      addPayoutAccountSchema.safeParse({
        bank_code: "058",
        bank_name: "GTBank",
        account_number: "123",
        account_name: "Test User",
      }).success,
    ).toBe(false);
  });

  it("ngnToKobo rounds correctly", () => {
    expect(ngnToKobo(100.5)).toBe(10050);
  });

  it("validateWithdrawalAmountKobo enforces minimum", () => {
    expect(validateWithdrawalAmountKobo(100)).toMatch(/Minimum/);
    expect(validateWithdrawalAmountKobo(5_000_000)).toBeNull();
  });
});
