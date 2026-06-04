import { PRESIGN_TTL_SECONDS } from "@/lib/media/constants";
import { streamApi } from "@/lib/media/stream/client";

type DirectUploadResult = {
  uploadURL: string;
  uid: string;
};

export async function createStreamDirectUpload(input: {
  maxDurationSeconds?: number;
  creatorId: string;
  uploadId: string;
}): Promise<{
  uploadUrl: string;
  streamUid: string;
  expiresAt: Date;
}> {
  const expiry = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString();

  const result = await streamApi<DirectUploadResult>("/direct_upload", {
    method: "POST",
    body: JSON.stringify({
      maxDurationSeconds: input.maxDurationSeconds ?? 3600,
      expiry,
      requireSignedURLs: true,
      meta: {
        creator_id: input.creatorId,
        upload_id: input.uploadId,
      },
    }),
  });

  return {
    uploadUrl: result.uploadURL,
    streamUid: result.uid,
    expiresAt: new Date(expiry),
  };
}

export type StreamVideoStatus = {
  uid: string;
  status: { state: string };
  thumbnail?: string;
  duration?: number;
  size?: number;
  meta?: Record<string, string>;
};

export async function getStreamVideo(
  streamUid: string,
): Promise<StreamVideoStatus | null> {
  try {
    return await streamApi<StreamVideoStatus>(`/${streamUid}`);
  } catch {
    return null;
  }
}

export async function createStreamSignedPlaybackUrl(
  streamUid: string,
): Promise<{ url: string; expiresAt: Date } | null> {
  try {
    const token = await streamApi<{ token: string }>(
      `/${streamUid}/token`,
      { method: "POST" },
    );
    const url = `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE ?? "default"}.cloudflarestream.com/${token.token}/manifest/video.m3u8`;
    return {
      url,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  } catch {
    const video = await getStreamVideo(streamUid);
    if (!video) return null;
    return {
      url: `https://iframe.videodelivery.net/${streamUid}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }
}
