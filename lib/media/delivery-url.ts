export type MediaDeliveryProxyParams = {
  uploadId?: string | null;
  objectKey?: string | null;
  streamUid?: string | null;
  /** When true (default), append redirect=1 for browser img/video src. */
  redirect?: boolean;
};

export function buildMediaDeliveryProxyUrl(
  params: MediaDeliveryProxyParams,
): string | null {
  const search = new URLSearchParams();

  if (params.uploadId) {
    search.set("uploadId", params.uploadId);
  } else if (params.streamUid) {
    search.set("streamUid", params.streamUid);
  } else if (params.objectKey) {
    search.set("objectKey", params.objectKey);
  } else {
    return null;
  }

  if (params.redirect !== false) {
    search.set("redirect", "1");
  }

  return `/api/v1/media/delivery?${search.toString()}`;
}

export function isMediaDeliveryProxyUrl(url: string): boolean {
  return (
    url.startsWith("/api/v1/media/delivery") ||
    url.includes("/api/v1/media/delivery?")
  );
}

/** Normalize stored absolute delivery URLs to same-origin relative paths. */
export function normalizeMediaUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;

  const trimmed = url.trim();

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith("/api/v1/media/delivery")) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}
