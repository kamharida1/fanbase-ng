import type { SupabaseClient } from "@supabase/supabase-js";

import { canDeliverByObjectKey, canDeliverMedia } from "@/lib/media/access";
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
import { validateMagicBytes, validateUploadRequest } from "@/lib/media/validation";
import {
  applyVirusScanResult,
  enqueueVirusScan,
  finalizeUploadAfterScan,
} from "@/lib/media/virus-scan";
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

  const { data: row, error: insertError } = await supabase
    .from("media_uploads")
    .insert({
      owner_id: input.userId,
      context: input.context,
      context_ref_id: input.contextRefId,
      provider: useStream ? "stream" : "r2",
      mime_type: v.mime,
      original_filename: v.filename,
      byte_size: v.byteSize,
      status: "pending_upload",
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !row) {
    return { error: insertError?.message ?? "Could not create upload session." };
  }

  const uploadId = row.id as string;

  if (useStream) {
    const stream = await createStreamDirectUpload({
      creatorId: input.userId,
      uploadId,
    });

    await supabase
      .from("media_uploads")
      .update({ stream_uid: stream.streamUid })
      .eq("id", uploadId);

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

  await supabase
    .from("media_uploads")
    .update({ object_key: objectKey })
    .eq("id", uploadId);

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
      const deliveryUrl = `${APP_URL}/api/v1/media/delivery?uploadId=${bound.id}&redirect=1`;
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
      .eq("status", "ready")
      .maybeSingle();
    upload = data as MediaUploadRow | null;
  } else {
    upload = await canDeliverByObjectKey(supabase, {
      viewerId: input.viewerId,
      objectKey: input.objectKey ?? null,
      streamUid: input.streamUid ?? null,
    });
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
    await admin
      .from("post_media")
      .update({
        processing_status: "ready",
        thumbnail_url:
          input.thumbnail ??
          `https://videodelivery.net/${input.streamUid}/thumbnails/thumbnail.jpg`,
      })
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
