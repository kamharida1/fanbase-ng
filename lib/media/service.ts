import type { SupabaseClient } from "@supabase/supabase-js";

import { canDeliverByObjectKey, canDeliverMedia } from "@/lib/media/access";
import { buildMediaDeliveryProxyUrl } from "@/lib/media/delivery-url";
import { assertCanUploadToContext } from "@/lib/media/context-auth";
import { PRESIGN_TTL_SECONDS } from "@/lib/media/constants";
import {
  getStreamConfig,
  getVirusScanMode,
  isR2Configured,
  isStreamConfigured,
} from "@/lib/media/config";
import { bindUploadToContext } from "@/lib/media/bind";
import { buildObjectKey } from "@/lib/media/paths";
import { assertSafeObjectKey } from "@/lib/security/object-key";
import { createR2PresignedGet, createR2PresignedPut, headR2Object } from "@/lib/media/r2/presign";
import {
  createStreamDirectUpload,
  createStreamSignedPlaybackUrl,
  getStreamVideo,
} from "@/lib/media/stream/direct-upload";
import { POST_MEDIA_BUCKET } from "@/lib/posts/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateMagicBytes, validateUploadRequest } from "@/lib/media/validation";
import {
  applyVirusScanResult,
  enqueueVirusScan,
  finalizeUploadAfterScan,
} from "@/lib/media/virus-scan";
import { runContentScan, runContentScanFromUrl } from "@/lib/media/content-scan";
import { applyContentScanResult } from "@/lib/media/violation-handler";
import type {
  ConfirmUploadResponse,
  MediaDeliveryResponse,
  MediaUploadRow,
  PresignUploadResponse,
} from "@/types/media";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function createPresignedUpload(
  supabase: SupabaseClient,
  input: {
    userId: string;
    isCreator: boolean;
    context: "post" | "message" | "profile";
    contextRefId: string;
    mime: string;
    byteSize: number;
    filename: string;
  },
): Promise<PresignUploadResponse | { error: string }> {
  const auth = await assertCanUploadToContext(supabase, {
    userId: input.userId,
    context: input.context,
    contextRefId: input.contextRefId,
    isCreator: input.isCreator,
  });

  if (!auth.ok) return { error: auth.error };

  const validated = validateUploadRequest({
    context: input.context,
    mime: input.mime,
    byteSize: input.byteSize,
    filename: input.filename,
  });

  if (!validated.ok) return { error: validated.error };

  const { data: v } = validated;
  const useStream = v.useStream && isStreamConfigured();
  const useR2 = !useStream && isR2Configured();

  if (!useStream && !useR2) {
    return {
      error:
        "Media storage is not configured. Set R2 and/or Cloudflare Stream environment variables.",
    };
  }

  const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000);
  const uploadId = crypto.randomUUID();

  if (useStream) {
    const stream = await createStreamDirectUpload({
      creatorId: input.userId,
      uploadId,
    });

    const { error: insertError } = await supabase.from("media_uploads").insert({
      id: uploadId,
      owner_id: input.userId,
      context: input.context,
      context_ref_id: input.contextRefId,
      provider: "stream",
      stream_uid: stream.streamUid,
      mime_type: v.mime,
      original_filename: v.filename,
      byte_size: v.byteSize,
      status: "pending_upload",
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      return { error: insertError.message };
    }

    return {
      uploadId,
      provider: "stream",
      uploadUrl: stream.uploadUrl,
      streamUid: stream.streamUid,
      expiresAt: stream.expiresAt.toISOString(),
    };
  }

  const objectKey = buildObjectKey({
    context: input.context,
    ownerId: input.userId,
    uploadId,
    filename: v.filename,
  });

  try {
    assertSafeObjectKey(objectKey, {
      ownerId: input.userId,
      uploadId,
      context: input.context,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Invalid storage key.",
    };
  }

  const presign = await createR2PresignedPut({
    objectKey,
    mimeType: v.mime,
    byteSize: v.byteSize,
  });

  const { error: insertError } = await supabase.from("media_uploads").insert({
    id: uploadId,
    owner_id: input.userId,
    context: input.context,
    context_ref_id: input.contextRefId,
    provider: "r2",
    object_key: objectKey,
    mime_type: v.mime,
    original_filename: v.filename,
    byte_size: v.byteSize,
    status: "pending_upload",
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    return { error: insertError.message };
  }

  return {
    uploadId,
    provider: "r2",
    uploadUrl: presign.uploadUrl,
    method: "PUT",
    headers: presign.headers,
    expiresAt: presign.expiresAt.toISOString(),
  };
}

export async function confirmMediaUpload(
  admin: SupabaseClient,
  input: {
    userId: string;
    uploadId: string;
    streamUid?: string;
  },
): Promise<ConfirmUploadResponse | { error: string }> {
  const { data: raw } = await admin
    .from("media_uploads")
    .select("*")
    .eq("id", input.uploadId)
    .eq("owner_id", input.userId)
    .maybeSingle();

  if (!raw) return { error: "Upload session not found." };

  const upload = raw as MediaUploadRow;

  if (upload.status === "ready") {
    return {
      uploadId: upload.id,
      status: "ready",
      scanStatus: upload.scan_status,
      boundEntityId: upload.bound_entity_id ?? undefined,
      boundEntityType: upload.bound_entity_type ?? undefined,
    };
  }

  if (upload.status === "scanning") {
    if (upload.scan_status === "pending") {
      return {
        uploadId: upload.id,
        status: "scanning",
        scanStatus: "pending",
      };
    }
    if (upload.scan_status === "clean" || upload.scan_status === "skipped") {
      const finalized = await finalizeUploadAfterScan(admin, upload.id);
      if (finalized) {
        return {
          uploadId: finalized.id,
          status: finalized.status,
          scanStatus: finalized.scan_status,
          boundEntityId: finalized.bound_entity_id ?? undefined,
          boundEntityType: finalized.bound_entity_type ?? undefined,
        };
      }
    }
    if (upload.scan_status === "infected") {
      return { error: "File rejected by security scan." };
    }
  }

  if (upload.status === "expired" || new Date(upload.expires_at) < new Date()) {
    await admin
      .from("media_uploads")
      .update({ status: "expired" })
      .eq("id", upload.id);
    return { error: "Upload session expired. Request a new presigned URL." };
  }

  if (upload.provider === "stream") {
    const uid = input.streamUid ?? upload.stream_uid;
    if (!uid) return { error: "Missing Stream video id." };

    const video = await getStreamVideo(uid);
    if (!video) {
      return { error: "Video not found in Stream. Finish uploading first." };
    }

    const state = video.status?.state;
    if (state === "error") {
      await admin
        .from("media_uploads")
        .update({ status: "failed" })
        .eq("id", upload.id);
      return { error: "Video processing failed in Stream." };
    }

    if (state !== "ready" && state !== "queued" && state !== "inprogress") {
      return {
        error: `Video is still ${state ?? "processing"}. Try again shortly.`,
      };
    }

    await admin
      .from("media_uploads")
      .update({
        stream_uid: uid,
        status: "uploaded",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", upload.id);
  } else {
    if (!upload.object_key) {
      return { error: "Missing storage key." };
    }

    try {
      assertSafeObjectKey(upload.object_key, {
        ownerId: upload.owner_id,
        uploadId: upload.id,
        context: upload.context,
      });
    } catch {
      return { error: "Invalid upload storage key." };
    }

    const head = await headR2Object(upload.object_key);
    if (!head.exists) {
      return { error: "File not found in storage. Complete the upload first." };
    }

    if (
      head.contentLength != null &&
      Math.abs(head.contentLength - upload.byte_size) > 1024
    ) {
      return { error: "Uploaded file size does not match declared size." };
    }

    if (head.firstBytes && !validateMagicBytes(head.firstBytes, upload.mime_type)) {
      await admin
        .from("media_uploads")
        .update({ status: "rejected", scan_status: "infected" })
        .eq("id", upload.id);
      return { error: "File content does not match declared type." };
    }

    await admin
      .from("media_uploads")
      .update({
        status: "uploaded",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", upload.id);
  }

  const refreshed = (await admin
    .from("media_uploads")
    .select("*")
    .eq("id", upload.id)
    .single()).data as MediaUploadRow;

  // ── Content moderation scan (R2 images only; Stream videos are scanned
  //    via thumbnail in handleStreamWebhook when the video becomes ready) ──
  if (refreshed.provider === "r2") {
    const contentResult = await runContentScan(admin, refreshed);
    const { blocked } = await applyContentScanResult(admin, refreshed, contentResult);
    if (blocked) {
      return { error: "Upload rejected: content policy violation." };
    }
  }

  await admin
    .from("media_uploads")
    .update({ status: "scanning" })
    .eq("id", upload.id);

  const scan = await enqueueVirusScan(refreshed);

  await admin
    .from("media_uploads")
    .update({
      scan_status: scan.scanStatus,
      scan_provider: scan.provider,
    })
    .eq("id", upload.id);

  if (scan.scanStatus === "skipped") {
    const bound = await bindUploadToContext(admin, {
      ...refreshed,
      scan_status: "skipped",
    });

    if (!bound) return { error: "Could not attach media to content." };

    if (bound.context === "profile") {
      const deliveryUrl = buildMediaDeliveryProxyUrl({ uploadId: bound.id })!;
      const field =
        bound.original_filename.toLowerCase().includes("banner")
          ? "banner"
          : "avatar";
      if (field === "avatar") {
        await admin
          .from("profiles")
          .update({ avatar_url: deliveryUrl })
          .eq("id", bound.owner_id);
      } else {
        await admin
          .from("creator_profiles")
          .update({ banner_url: deliveryUrl })
          .eq("user_id", bound.owner_id);
      }
    }

    return {
      uploadId: bound.id,
      status: "ready",
      scanStatus: "skipped",
      boundEntityId: bound.bound_entity_id ?? undefined,
      boundEntityType: bound.bound_entity_type ?? undefined,
    };
  }

  if (getVirusScanMode() === "required") {
    return {
      uploadId: upload.id,
      status: "scanning",
      scanStatus: "pending",
    };
  }

  const finalized = await finalizeUploadAfterScan(admin, upload.id);
  if (!finalized) {
    return {
      uploadId: upload.id,
      status: "scanning",
      scanStatus: scan.scanStatus,
    };
  }

  return {
    uploadId: finalized.id,
    status: finalized.status,
    scanStatus: finalized.scan_status,
    boundEntityId: finalized.bound_entity_id ?? undefined,
    boundEntityType: finalized.bound_entity_type ?? undefined,
  };
}

const DELIVERABLE_UPLOAD_STATUSES = ["ready", "uploaded", "scanning"] as const;

async function resolveLegacyPostMediaDelivery(
  supabase: SupabaseClient,
  input: { viewerId: string | null; objectKey: string },
): Promise<MediaDeliveryResponse | null> {
  const admin = createAdminClient();
  const { data: media } = await admin
    .from("post_media")
    .select("post_id")
    .eq("r2_key", input.objectKey)
    .maybeSingle();

  if (!media?.post_id) return null;

  const { data: canView } = await supabase.rpc("can_view_post", {
    p_user_id: input.viewerId,
    p_post_id: media.post_id,
  });

  if (!canView) return null;

  const { data, error } = await admin.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUrl(input.objectKey, 3600);

  if (error || !data?.signedUrl) return null;

  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    provider: "r2",
  };
}

export async function getMediaDeliveryUrl(
  supabase: SupabaseClient,
  input: {
    viewerId: string | null;
    uploadId?: string;
    objectKey?: string;
    streamUid?: string;
  },
): Promise<MediaDeliveryResponse | { error: string }> {
  if (
    input.objectKey &&
    (input.objectKey.includes("..") || input.objectKey.includes("\\"))
  ) {
    return { error: "Invalid media reference." };
  }

  let upload: MediaUploadRow | null = null;

  if (input.uploadId) {
    const { data } = await supabase
      .from("media_uploads")
      .select("*")
      .eq("id", input.uploadId)
      .in("status", [...DELIVERABLE_UPLOAD_STATUSES])
      .maybeSingle();
    upload = data as MediaUploadRow | null;
  } else {
    upload = await canDeliverByObjectKey(supabase, {
      viewerId: input.viewerId,
      objectKey: input.objectKey ?? null,
      streamUid: input.streamUid ?? null,
    });
  }

  if (!upload && input.objectKey) {
    const legacy = await resolveLegacyPostMediaDelivery(supabase, {
      viewerId: input.viewerId,
      objectKey: input.objectKey,
    });
    if (legacy) return legacy;
  }

  if (!upload) return { error: "Media not found." };

  const allowed = await canDeliverMedia(supabase, {
    viewerId: input.viewerId,
    context: upload.context,
    contextRefId: upload.context_ref_id,
    ownerId: upload.owner_id,
    postId: upload.context === "post" ? upload.context_ref_id : undefined,
  });

  if (!allowed) return { error: "Access denied." };

  if (upload.provider === "stream" && upload.stream_uid) {
    if (!getStreamConfig()) {
      return { error: "Stream playback is not configured." };
    }
    const playback = await createStreamSignedPlaybackUrl(upload.stream_uid);
    if (!playback) {
      return {
        url: `https://iframe.videodelivery.net/${upload.stream_uid}`,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        provider: "stream",
      };
    }
    return {
      url: playback.url,
      expiresAt: playback.expiresAt.toISOString(),
      provider: "stream",
    };
  }

  if (!upload.object_key) return { error: "Missing object key." };

  const signed = await createR2PresignedGet(upload.object_key);
  return {
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
    provider: "r2",
  };
}

export async function handleStreamWebhook(
  admin: SupabaseClient,
  input: { streamUid: string; state: string; thumbnail?: string },
): Promise<void> {
  const { data: upload } = await admin
    .from("media_uploads")
    .select("*")
    .eq("stream_uid", input.streamUid)
    .maybeSingle();

  if (!upload) return;

  const row = upload as MediaUploadRow;

  if (input.state === "ready") {
    const thumbnailUrl =
      input.thumbnail ??
      `https://videodelivery.net/${input.streamUid}/thumbnails/thumbnail.jpg`;

    // Run content scan before marking post_media ready — blocked videos must
    // not surface to fans even briefly.
    const contentResult = await runContentScanFromUrl(admin, thumbnailUrl);
    const { blocked } = await applyContentScanResult(admin, row, contentResult);

    if (blocked) {
      await admin
        .from("media_uploads")
        .update({ status: "rejected" })
        .eq("id", row.id);
      await admin
        .from("post_media")
        .update({ processing_status: "failed", thumbnail_url: thumbnailUrl })
        .eq("media_upload_id", row.id);
      return;
    }

    await admin
      .from("post_media")
      .update({ processing_status: "ready", thumbnail_url: thumbnailUrl })
      .eq("media_upload_id", row.id);

    if (row.status === "scanning" && row.scan_status === "pending") {
      await applyVirusScanResult(admin, {
        uploadId: row.id,
        status: "clean",
        provider: "stream",
        details: { streamState: input.state },
      });
      await finalizeUploadAfterScan(admin, row.id);
    }
  }

  if (input.state === "error") {
    await admin
      .from("media_uploads")
      .update({ status: "failed" })
      .eq("id", row.id);

    await admin
      .from("post_media")
      .update({ processing_status: "failed" })
      .eq("media_upload_id", row.id);
  }
}

export async function expireStaleUploads(admin: SupabaseClient): Promise<number> {
  const { data } = await admin
    .from("media_uploads")
    .update({ status: "expired" })
    .eq("status", "pending_upload")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  return data?.length ?? 0;
}
