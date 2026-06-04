import { S3Client } from "@aws-sdk/client-s3";

import { getR2Config } from "@/lib/media/config";

let cached: S3Client | null = null;

export function getR2Client(): S3Client {
  if (cached) return cached;

  const config = getR2Config();
  if (!config) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.",
    );
  }

  cached = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cached;
}

export function getR2BucketName(): string {
  const config = getR2Config();
  if (!config) throw new Error("R2 bucket not configured.");
  return config.bucketName;
}
