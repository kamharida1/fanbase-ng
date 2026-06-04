import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getMediaWebhookSecret,
  getVirusScanMode,
  getVirusScanWebhookUrl,
} from "@/lib/media/config";
import type { MediaScanStatus, MediaUploadRow } from "@/types/media";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function enqueueVirusScan(
  upload: Pick<
    MediaUploadRow,
    "id" | "owner_id" | "object_key" | "stream_uid" | "provider" | "mime_type" | "byte_size"
  >,
): Promise<{ scanStatus: MediaScanStatus; provider: string | null }> {
  const mode = getVirusScanMode();

  if (mode === "off") {
    return { scanStatus: "skipped", provider: null };
  }

  const webhookUrl = getVirusScanWebhookUrl();
  if (!webhookUrl) {
    if (mode === "required") {
      throw new Error("VIRUS_SCAN_WEBHOOK_URL is required in production scan mode.");
    }
    return { scanStatus: "skipped", provider: null };
  }

  const callbackUrl = `${APP_URL}/api/v1/media/webhooks/virus-scan`;
  const secret = getMediaWebhookSecret();

  const payload = {
    uploadId: upload.id,
    ownerId: upload.owner_id,
    provider: upload.provider,
    objectKey: upload.object_key,
    streamUid: upload.stream_uid,
    mimeType: upload.mime_type,
    byteSize: upload.byte_size,
    callbackUrl,
    callbackSecret: secret,
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Virus scan enqueue failed: ${text || res.status}`);
  }

  return { scanStatus: "pending", provider: "external" };
}

export async function applyVirusScanResult(
  admin: SupabaseClient,
  input: {
    uploadId: string;
    status: "clean" | "infected" | "error";
    provider?: string;
    details?: Record<string, unknown>;
  },
): Promise<MediaUploadRow | null> {
  const scanStatus: MediaScanStatus =
    input.status === "clean"
      ? "clean"
      : input.status === "infected"
        ? "infected"
        : "error";

  const { data: upload, error } = await admin
    .from("media_uploads")
    .update({
      scan_status: scanStatus,
      scan_provider: input.provider ?? "external",
      scan_result: input.details ?? {},
      status: input.status === "clean" ? "scanning" : "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.uploadId)
    .select("*")
    .maybeSingle();

  if (error || !upload) return null;

  if (input.status === "clean") {
    return upload as MediaUploadRow;
  }

  return upload as MediaUploadRow;
}

export async function finalizeUploadAfterScan(
  admin: SupabaseClient,
  uploadId: string,
): Promise<MediaUploadRow | null> {
  const { data } = await admin
    .from("media_uploads")
    .select("*")
    .eq("id", uploadId)
    .maybeSingle();

  if (!data) return null;
  const upload = data as MediaUploadRow;

  if (upload.scan_status === "infected" || upload.scan_status === "error") {
    await admin
      .from("media_uploads")
      .update({ status: "rejected" })
      .eq("id", uploadId);
    return null;
  }

  if (
    upload.scan_status !== "clean" &&
    upload.scan_status !== "skipped"
  ) {
    return null;
  }

  const { bindUploadToContext } = await import("@/lib/media/bind");
  return bindUploadToContext(admin, upload);
}
