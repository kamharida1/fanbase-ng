import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildMediaDeliveryProxyUrl,
  normalizeMediaUrl,
} from "@/lib/media/delivery-url";
import { isR2Configured, isStreamConfigured } from "@/lib/media/config";

export async function resolvePostMediaUrl(
  supabase: SupabaseClient,
  input: {
    viewerId: string | null;
    canViewFull: boolean;
    mediaUploadId?: string | null;
    r2Key?: string | null;
    streamUid?: string | null;
    thumbnailUrl?: string | null;
  },
): Promise<string | null> {
  if (!input.canViewFull) {
    if (input.thumbnailUrl) return normalizeMediaUrl(input.thumbnailUrl);
    if (input.streamUid) {
      return `https://videodelivery.net/${input.streamUid}/thumbnails/thumbnail.jpg`;
    }
    return null;
  }

  // Stable same-origin proxy URLs — access is enforced when the browser loads them.
  if (input.mediaUploadId && (isR2Configured() || isStreamConfigured())) {
    return buildMediaDeliveryProxyUrl({ uploadId: input.mediaUploadId });
  }

  if (input.streamUid && isStreamConfigured()) {
    return buildMediaDeliveryProxyUrl({ streamUid: input.streamUid });
  }

  if (input.r2Key) {
    return buildMediaDeliveryProxyUrl({ objectKey: input.r2Key });
  }

  return normalizeMediaUrl(input.thumbnailUrl);
}

export async function resolveMessageAttachmentUrl(
  supabase: SupabaseClient,
  input: {
    viewerId: string | null;
    mediaUploadId?: string | null;
    storagePath?: string | null;
  },
): Promise<string | null> {
  if (input.mediaUploadId && (isR2Configured() || isStreamConfigured())) {
    return buildMediaDeliveryProxyUrl({ uploadId: input.mediaUploadId });
  }

  if (input.storagePath) {
    return buildMediaDeliveryProxyUrl({ objectKey: input.storagePath });
  }

  return null;
}
