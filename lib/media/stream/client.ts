import { getStreamConfig } from "@/lib/media/config";

const API_BASE = "https://api.cloudflare.com/client/v4";

export async function streamApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = getStreamConfig();
  if (!config) {
    throw new Error(
      "Cloudflare Stream is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN.",
    );
  }

  const res = await fetch(
    `${API_BASE}/accounts/${config.accountId}/stream${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    },
  );

  const json = (await res.json()) as {
    success: boolean;
    errors?: { message: string }[];
    result?: T;
  };

  if (!res.ok || !json.success) {
    const msg =
      json.errors?.[0]?.message ?? `Stream API error (${res.status})`;
    throw new Error(msg);
  }

  return json.result as T;
}
