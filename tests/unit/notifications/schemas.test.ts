import { describe, expect, it } from "vitest";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_TYPES,
  NOTIFICATIONS_PAGE_SIZE,
} from "@/lib/notifications/constants";
import {
  listNotificationsSchema,
  markReadSchema,
} from "@/lib/notifications/schemas";

describe("notifications", () => {
  it("exports constants", () => {
    expect(NOTIFICATION_TYPES.length).toBe(7);
    expect(NOTIFICATIONS_PAGE_SIZE).toBe(25);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.new_message).toBe(true);
  });

  it("parses mark read", () => {
    expect(markReadSchema.safeParse({ markAll: true }).success).toBe(true);
  });

  it("parses list query", () => {
    expect(listNotificationsSchema.safeParse({ limit: 10 }).success).toBe(
      true,
    );
  });
});
