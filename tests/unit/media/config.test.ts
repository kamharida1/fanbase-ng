import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getR2Config,
  getStreamConfig,
  getVirusScanMode,
  isR2Configured,
  isStreamConfigured,
} from "@/lib/media/config";
import { withNodeEnv } from "../../helpers/env";

describe("media config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
  });

  it("returns null when R2 env incomplete", () => {
    expect(getR2Config()).toBeNull();
    expect(isR2Configured()).toBe(false);
  });

  it("returns R2 config when all vars set", () => {
    vi.stubEnv("R2_ACCOUNT_ID", "acc");
    vi.stubEnv("R2_ACCESS_KEY_ID", "key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("R2_BUCKET_NAME", "bucket");
    expect(getR2Config()).toEqual({
      accountId: "acc",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucketName: "bucket",
    });
    expect(isR2Configured()).toBe(true);
  });

  it("returns stream config from Cloudflare vars", () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "cf-acc");
    vi.stubEnv("CLOUDFLARE_STREAM_API_TOKEN", "token");
    expect(getStreamConfig()).toEqual({
      accountId: "cf-acc",
      apiToken: "token",
    });
    expect(isStreamConfigured()).toBe(true);
  });

  it("defaults virus scan to off in non-production", () => {
    withNodeEnv("development", () => {
      expect(getVirusScanMode()).toBe("off");
    });
  });

  it("defaults virus scan to async in production", () => {
    withNodeEnv("production", () => {
      expect(getVirusScanMode()).toBe("async");
    });
  });
});
