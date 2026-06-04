import type { SupabaseClient } from "@supabase/supabase-js";

import { isR2Configured, isStreamConfigured } from "@/lib/media/config";
import { getMediaDeliveryUrl } from "@/lib/media/service";
import { getPostMediaSignedUrl } from "@/lib/posts/storage";
import { getSignedAttachmentUrl } from "@/lib/messaging/storage";

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
    if (input.thumbnailUrl) return input.thumbnailUrl;
    if (input.streamUid) {
      return `https://videodelivery.net/${input.streamUid}/thumbnails/thumbnail.jpg`;
    }
    return null;
  }

  if (input.mediaUploadId && (isR2Configured() || isStreamConfigured())) {
    const result = await getMediaDeliveryUrl(supabase, {
      viewerId: input.viewerId,
      uploadId: input.mediaUploadId,
    });
    if (!("error" in result)) return result.url;
  }

  if (input.streamUid && isStreamConfigured()) {
    const result = await getMediaDeliveryUrl(supabase, {
      viewerId: input.viewerId,
      streamUid: input.streamUid,
    });
    if (!("error" in result)) return result.url;
    return `https://iframe.videodelivery.net/${input.streamUid}`;
  }

  if (input.r2Key && isR2Configured()) {
    const result = await getMediaDeliveryUrl(supabase, {
      viewerId: input.viewerId,
      objectKey: input.r2Key,
    });
    if (!("error" in result)) return result.url;
  }

  if (input.r2Key) {
    return getPostMediaSignedUrl(supabase, input.r2Key);
  }

  return input.thumbnailUrl ?? null;
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
    const result = await getMediaDeliveryUrl(supabase, {
      viewerId: input.viewerId,
      uploadId: input.mediaUploadId,
    });
    if (!("error" in result)) return result.url;
  }

  if (input.storagePath && isR2Configured()) {
    const result = await getMediaDeliveryUrl(supabase, {
      viewerId: input.viewerId,
      objectKey: input.storagePath,
    });
    if (!("error" in result)) return result.url;
  }

  if (input.storagePath) {
    return getSignedAttachmentUrl(supabase, input.storagePath);
  }

  return null;
}
