import { describe, expect, it } from "vitest";

import { payoutStatusLabel, walletTxLabel } from "@/lib/wallets/format";

describe("wallet format helpers", () => {
  it("labels known transaction types", () => {
    expect(walletTxLabel("ppv_credit")).toBe("PPV earnings");
    expect(walletTxLabel("custom_type")).toBe("custom type");
  });

  it("formats payout status", () => {
    expect(payoutStatusLabel("pending_review")).toBe("pending review");
  });
});
