import type { SupabaseClient } from "@supabase/supabase-js";

export type LiveStreamRow = {
  id: string;
  creator_id: string;
  title: string;
  status: "idle" | "live" | "ended";
  cloudflare_uid: string | null;
  embed_url: string | null;
  viewer_count: number;
  thumbnail_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LiveStreamCreatorRow = LiveStreamRow & {
  rtmps_url: string | null;
  stream_key: string | null;
};

const VIEWER_COLS =
  "id, creator_id, title, status, cloudflare_uid, embed_url, viewer_count, thumbnail_url, started_at, ended_at, created_at, updated_at";

const CREATOR_COLS = `${VIEWER_COLS}, rtmps_url, stream_key`;

/** For the creator's own go-live panel — includes RTMP credentials. */
export async function getCreatorLiveStream(
  admin: SupabaseClient,
  creatorId: string,
): Promise<LiveStreamCreatorRow | null> {
  const { data } = await admin
    .from("live_streams")
    .select(CREATOR_COLS)
    .eq("creator_id", creatorId)
    .in("status", ["idle", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as LiveStreamCreatorRow | null;
}

/** For viewers — never includes RTMP credentials. */
export async function getPublicLiveStream(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<LiveStreamRow | null> {
  const { data } = await supabase
    .from("live_streams")
    .select(VIEWER_COLS)
    .eq("creator_id", creatorId)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as LiveStreamRow | null;
}

/** All currently live streams for the discover / feed surface. */
export async function listLiveStreams(
  supabase: SupabaseClient,
  limit = 12,
): Promise<LiveStreamRow[]> {
  const { data } = await supabase
    .from("live_streams")
    .select(VIEWER_COLS)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as LiveStreamRow[];
}
