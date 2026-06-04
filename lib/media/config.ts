export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

export type StreamConfig = {
  accountId: string;
  apiToken: string;
};

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export function getStreamConfig(): StreamConfig | null {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;

  if (!accountId || !apiToken) return null;

  return { accountId, apiToken };
}

export function getMediaWebhookSecret(): string | null {
  return process.env.MEDIA_WEBHOOK_SECRET ?? null;
}

export function getVirusScanWebhookUrl(): string | null {
  return process.env.VIRUS_SCAN_WEBHOOK_URL ?? null;
}

/** off = skip scan; async = queue external scan; required = block until clean webhook */
export function getVirusScanMode(): "off" | "async" | "required" {
  const mode = process.env.VIRUS_SCAN_MODE?.toLowerCase();
  if (mode === "off" || mode === "async" || mode === "required") return mode;
  return process.env.NODE_ENV === "production" ? "async" : "off";
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

export function isStreamConfigured(): boolean {
  return getStreamConfig() !== null;
}
