import { describe, expect, it } from "vitest";

import {
  buildMediaDeliveryProxyUrl,
  isMediaDeliveryProxyUrl,
  normalizeMediaUrl,
} from "@/lib/media/delivery-url";

describe("buildMediaDeliveryProxyUrl", () => {
  it("builds uploadId proxy with redirect", () => {
    expect(buildMediaDeliveryProxyUrl({ uploadId: "abc-123" })).toBe(
      "/api/v1/media/delivery?uploadId=abc-123&redirect=1",
    );
  });

  it("builds streamUid proxy", () => {
    expect(buildMediaDeliveryProxyUrl({ streamUid: "stream-1" })).toBe(
      "/api/v1/media/delivery?streamUid=stream-1&redirect=1",
    );
  });

  it("builds objectKey proxy", () => {
    expect(
      buildMediaDeliveryProxyUrl({ objectKey: "posts/abc/file.jpg" }),
    ).toBe("/api/v1/media/delivery?objectKey=posts%2Fabc%2Ffile.jpg&redirect=1");
  });

  it("returns null when no reference is provided", () => {
    expect(buildMediaDeliveryProxyUrl({})).toBeNull();
  });

  it("prefers uploadId over other refs", () => {
    expect(
      buildMediaDeliveryProxyUrl({
        uploadId: "u1",
        streamUid: "s1",
        objectKey: "k1",
      }),
    ).toBe("/api/v1/media/delivery?uploadId=u1&redirect=1");
  });
});

describe("normalizeMediaUrl", () => {
  it("passes through relative delivery paths", () => {
    expect(
      normalizeMediaUrl("/api/v1/media/delivery?uploadId=x&redirect=1"),
    ).toBe("/api/v1/media/delivery?uploadId=x&redirect=1");
  });

  it("strips absolute origin from stored delivery URLs", () => {
    expect(
      normalizeMediaUrl(
        "http://localhost:3000/api/v1/media/delivery?uploadId=x&redirect=1",
      ),
    ).toBe("/api/v1/media/delivery?uploadId=x&redirect=1");
    expect(
      normalizeMediaUrl(
        "https://fanbaseng.com/api/v1/media/delivery?uploadId=x&redirect=1",
      ),
    ).toBe("/api/v1/media/delivery?uploadId=x&redirect=1");
  });

  it("returns null for empty values", () => {
    expect(normalizeMediaUrl(null)).toBeNull();
    expect(normalizeMediaUrl("")).toBeNull();
  });
});

describe("isMediaDeliveryProxyUrl", () => {
  it("detects delivery proxy paths", () => {
    expect(isMediaDeliveryProxyUrl("/api/v1/media/delivery?uploadId=x")).toBe(
      true,
    );
    expect(isMediaDeliveryProxyUrl("https://fanbaseng.com/api/v1/media/delivery?x=1")).toBe(
      true,
    );
    expect(isMediaDeliveryProxyUrl("https://videodelivery.net/x")).toBe(false);
  });
});
