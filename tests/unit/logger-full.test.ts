import { afterEach, describe, expect, it, vi } from "vitest";

import { log, logger } from "@/lib/logger";
import { withNodeEnv } from "../helpers/env";

describe("logger levels", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs info and warn", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.info("info.event");
    logger.warn("warn.event", { x: 1 });
    expect(info).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("skips debug in production", () => {
    withNodeEnv("production", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      log("debug", "hidden");
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
