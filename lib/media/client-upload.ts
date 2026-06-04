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
