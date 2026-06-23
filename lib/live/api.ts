import { getStreamConfig } from "@/lib/media/config";

const API_BASE = "https://api.cloudflare.com/client/v4";

function liveApi<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getStreamConfig();
  if (!config) throw new Error("Cloudflare Stream is not configured.");

  return fetch(
    `${API_BASE}/accounts/${config.accountId}/stream/live_inputs${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    },
  ).then(async (res) => {
    const json = (await res.json()) as {
      success: boolean;
      errors?: { message: string }[];
      result?: T;
    };
    if (!res.ok || !json.success) {
      throw new Error(
        json.errors?.[0]?.message ?? `Stream API error (${res.status})`,
      );
    }
    return json.result as T;
  });
}

export type LiveInputResult = {
  uid: string;
  rtmpsUrl: string;
  streamKey: string;
  embedUrl: string;
};

export async function createLiveInput(input: {
  title: string;
  creatorId: string;
}): Promise<LiveInputResult> {
  const customerCode = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE;
  if (!customerCode) throw new Error("CLOUDFLARE_STREAM_CUSTOMER_CODE is not set.");

  const result = await liveApi<{
    uid: string;
    rtmps: { url: string; streamKey: string };
  }>("", {
    method: "POST",
    body: JSON.stringify({
      meta: { name: input.title, creator_id: input.creatorId },
      recording: { mode: "automatic" },
    }),
  });

  return {
    uid: result.uid,
    rtmpsUrl: result.rtmps.url,
    streamKey: result.rtmps.streamKey,
    embedUrl: `https://customer-${customerCode}.cloudflarestream.com/${result.uid}/iframe`,
  };
}

export async function deleteLiveInput(uid: string): Promise<void> {
  await liveApi(`/${uid}`, { method: "DELETE" });
}

export async function getLiveInputStatus(uid: string): Promise<{
  connected: boolean;
  connectedSince: string | null;
}> {
  const result = await liveApi<{
    uid: string;
    status: {
      current?: { state?: string; connectedSince?: string };
    } | null;
  }>(`/${uid}`);

  const state = result.status?.current?.state;
  return {
    connected: state === "connected",
    connectedSince: result.status?.current?.connectedSince ?? null,
  };
}
