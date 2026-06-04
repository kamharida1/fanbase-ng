import { describe, expect, it, vi } from "vitest";

import { writeAuditLog } from "@/lib/audit/log";
import { createMockSupabase, createQueryBuilder } from "@/tests/helpers/mock-supabase";

describe("writeAuditLog", () => {
  it("inserts audit row", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn().mockReturnValue({ insert }),
    };

    await writeAuditLog(admin as never, {
      actorType: "user",
      action: "payment.succeeded",
      entityType: "payments",
      entityId: "pay-1",
    });

    expect(insert).toHaveBeenCalled();
  });

  it("logs on insert failure", async () => {
    const admin = {
      from: vi.fn().mockReturnValue(
        createQueryBuilder({ data: null, error: null }),
      ),
    };
    admin.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        error: { message: "db down" },
      }),
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await writeAuditLog(admin as never, {
      actorType: "system",
      action: "media.scan.completed",
      entityType: "media_uploads",
    });
    expect(spy).toHaveBeenCalled();
  });
});
