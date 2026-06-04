import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { DELIVERY_TTL_SECONDS, PRESIGN_TTL_SECONDS } from "@/lib/media/constants";
import { getR2BucketName, getR2Client } from "@/lib/media/r2/client";

export async function createR2PresignedPut(input: {
  objectKey: string;
  mimeType: string;
  byteSize: number;
}): Promise<{ uploadUrl: string; headers: Record<string, string>; expiresAt: Date }> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.objectKey,
    ContentType: input.mimeType,
    ContentLength: input.byteSize,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_TTL_SECONDS,
  });

  const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000);

  return {
    uploadUrl,
    headers: {
      "Content-Type": input.mimeType,
      "Content-Length": String(input.byteSize),
    },
    expiresAt,
  };
}

export async function createR2PresignedGet(objectKey: string): Promise<{
  url: string;
  expiresAt: Date;
}> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: DELIVERY_TTL_SECONDS,
  });

  return {
    url,
    expiresAt: new Date(Date.now() + DELIVERY_TTL_SECONDS * 1000),
  };
}

export async function headR2Object(objectKey: string): Promise<{
  exists: boolean;
  contentLength?: number;
  contentType?: string;
  firstBytes?: Uint8Array;
}> {
  const client = getR2Client();
  const bucket = getR2BucketName();

  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
    );

    const get = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Range: "bytes=0-511",
      }),
    );

    const body = await get.Body?.transformToByteArray();

    return {
      exists: true,
      contentLength: head.ContentLength,
      contentType: head.ContentType,
      firstBytes: body,
    };
  } catch {
    return { exists: false };
  }
}
