import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs structured json on error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("test.event", { foo: "bar" });
    expect(spy).toHaveBeenCalledOnce();
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("error");
    expect(parsed.msg).toBe("test.event");
    expect(parsed.foo).toBe("bar");
  });
});
