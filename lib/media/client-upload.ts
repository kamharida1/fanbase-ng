import type { ConfirmUploadResponse, PresignUploadResponse } from "@/types/media";

export async function requestPresignedUpload(input: {
  context: "post" | "message" | "profile";
  contextRefId: string;
  file: File;
}): Promise<PresignUploadResponse> {
  const res = await fetch("/api/v1/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: input.context,
      contextRefId: input.contextRefId,
      mime: input.file.type,
      byteSize: input.file.size,
      filename: input.file.name,
    }),
  });

  const json = (await res.json()) as {
    data?: PresignUploadResponse;
    error?: string;
  };

  if (!res.ok || !json.data) {
    throw new Error(json.error ?? "Could not start upload.");
  }

  return json.data;
}

export async function uploadToPresignedTarget(
  presign: PresignUploadResponse,
  file: File,
): Promise<void> {
  if (presign.provider === "stream") {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(presign.uploadUrl, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error("Stream upload failed.");
    }
    return;
  }

  const res = await fetch(presign.uploadUrl, {
    method: presign.method,
    headers: presign.headers,
    body: file,
  });

  if (!res.ok) {
    throw new Error(`Storage upload failed (${res.status}).`);
  }
}

export async function confirmMediaUpload(input: {
  uploadId: string;
  streamUid?: string;
}): Promise<ConfirmUploadResponse> {
  const res = await fetch("/api/v1/media/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const json = (await res.json()) as {
    data?: ConfirmUploadResponse;
    error?: string;
  };

  if (!res.ok || !json.data) {
    throw new Error(json.error ?? "Could not confirm upload.");
  }

  return json.data;
}

export async function uploadFileWithPresign(input: {
  context: "post" | "message" | "profile";
  contextRefId: string;
  file: File;
  onProgress?: (phase: "presign" | "upload" | "confirm") => void;
}): Promise<ConfirmUploadResponse> {
  input.onProgress?.("presign");
  const presign = await requestPresignedUpload(input);

  input.onProgress?.("upload");
  await uploadToPresignedTarget(presign, input.file);

  input.onProgress?.("confirm");
  return confirmMediaUpload({
    uploadId: presign.uploadId,
    streamUid: presign.provider === "stream" ? presign.streamUid : undefined,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Re-hit confirm while backend finishes virus scan / binding. */
export async function pollUploadUntilReady(
  uploadId: string,
  options?: { streamUid?: string; maxAttempts?: number; intervalMs?: number },
): Promise<ConfirmUploadResponse> {
  const maxAttempts = options?.maxAttempts ?? 40;
  const intervalMs = options?.intervalMs ?? 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await confirmMediaUpload({
      uploadId,
      streamUid: options?.streamUid,
    });

    if (result.status === "ready") {
      return result;
    }

    if (result.status === "rejected" || result.status === "failed") {
      throw new Error("Upload was rejected during security processing.");
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  throw new Error(
    "Upload is still processing. Wait for the green checkmark before publishing.",
  );
}

export function humanizeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Upload failed.";
  if (message.includes("Media storage is not configured")) {
    return "Photo and video uploads are not set up on this server yet. Try a text post or contact support.";
  }
  return message;
}
