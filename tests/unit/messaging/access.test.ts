import { beforeEach, describe, expect, it, vi } from "vitest";

import { canSendMessageInConversation } from "@/lib/messaging/access";

describe("canSendMessageInConversation", () => {
  const supabase = {
    from: vi.fn(),
  } as unknown as Parameters<typeof canSendMessageInConversation>[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const base = {
    conversationId: "conv-1",
    senderId: "fan-1",
    fanId: "fan-1",
    creatorId: "creator-1",
    status: "pending" as const,
  };

  it("limits fans to one intro message while pending", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        count: 1,
      }),
    } as never);

    const result = await canSendMessageInConversation(supabase, base);
    expect(result).toEqual({
      allowed: false,
      reason:
        "Your message request was sent. Wait for the creator to accept before sending more.",
    });
  });

  it("allows staff to bypass pending intro limits", async () => {
    const result = await canSendMessageInConversation(supabase, {
      ...base,
      isStaff: true,
    });

    expect(result).toEqual({ allowed: true });
  });
});
