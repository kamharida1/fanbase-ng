"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { createLiveInput, deleteLiveInput, getLiveInputStatus } from "@/lib/live/api";
import { getCreatorLiveStream } from "@/lib/live/queries";
import { notifyCreatorLive } from "@/lib/notifications/emit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LiveActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export type StartLiveResult = {
  streamId: string;
  rtmpsUrl: string;
  streamKey: string;
  embedUrl: string;
  cloudflareUid: string;
};

export async function startLiveStream(
  title: string,
): Promise<LiveActionResult<StartLiveResult>> {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length > 150) {
    return { success: false, error: "Title must be 150 characters or fewer." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  const admin = createAdminClient();

  // End any existing idle/live stream first
  const existing = await getCreatorLiveStream(admin, auth.userId);
  if (existing) {
    if (existing.cloudflare_uid) {
      try {
        await deleteLiveInput(existing.cloudflare_uid);
      } catch {
        // best-effort cleanup
      }
    }
    await admin
      .from("live_streams")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  let liveInput: Awaited<ReturnType<typeof createLiveInput>>;
  try {
    liveInput = await createLiveInput({
      title: title.trim() || "Live stream",
      creatorId: auth.userId,
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not create live stream.",
    };
  }

  const { data: row, error: insertError } = await admin
    .from("live_streams")
    .insert({
      creator_id: auth.userId,
      title: title.trim() || "Live stream",
      status: "idle",
      cloudflare_uid: liveInput.uid,
      rtmps_url: liveInput.rtmpsUrl,
      stream_key: liveInput.streamKey,
      embed_url: liveInput.embedUrl,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    try {
      await deleteLiveInput(liveInput.uid);
    } catch {
      // best-effort cleanup
    }
    return { success: false, error: insertError?.message ?? "DB insert failed." };
  }

  await writeAuditLog(admin, {
    actorId: auth.userId,
    actorType: "user",
    action: "live.stream.started",
    entityType: "live_streams",
    entityId: row.id,
    metadata: { cloudflare_uid: liveInput.uid, title },
  });

  revalidatePath(`/creator/live`);

  return {
    success: true,
    data: {
      streamId: row.id,
      rtmpsUrl: liveInput.rtmpsUrl,
      streamKey: liveInput.streamKey,
      embedUrl: liveInput.embedUrl,
      cloudflareUid: liveInput.uid,
    },
  };
}

export async function markStreamLive(
  streamId: string,
): Promise<LiveActionResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  const admin = createAdminClient();

  const { error } = await admin
    .from("live_streams")
    .update({ status: "live", started_at: new Date().toISOString() })
    .eq("id", streamId)
    .eq("creator_id", auth.userId)
    .eq("status", "idle");

  if (error) return { success: false, error: error.message };

  // Notify up to 100 active subscribers
  try {
    await notifyCreatorLive(admin, {
      creatorId: auth.userId,
      streamId,
      title: "is live now",
    });
  } catch (err) {
    console.error("[live] notify subscribers", err);
  }

  revalidatePath(`/creator/live`);
  revalidatePath("/creators");
  return { success: true };
}

export async function endLiveStream(
  streamId: string,
): Promise<LiveActionResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  const admin = createAdminClient();

  const { data: stream } = await admin
    .from("live_streams")
    .select("id, cloudflare_uid, creator_id")
    .eq("id", streamId)
    .eq("creator_id", auth.userId)
    .maybeSingle();

  if (!stream) return { success: false, error: "Stream not found." };

  if (stream.cloudflare_uid) {
    try {
      await deleteLiveInput(stream.cloudflare_uid);
    } catch {
      // best-effort
    }
  }

  await admin
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", streamId);

  await writeAuditLog(admin, {
    actorId: auth.userId,
    actorType: "user",
    action: "live.stream.ended",
    entityType: "live_streams",
    entityId: streamId,
  });

  revalidatePath(`/creator/live`);
  revalidatePath("/creators");
  return { success: true };
}

/** Polls Cloudflare for connection status — called from the creator's go-live panel. */
export async function pollLiveStreamStatus(
  streamId: string,
): Promise<{ connected: boolean }> {
  try {
    const supabase = await createClient();
    const auth = await requireAuth(supabase);
    const admin = createAdminClient();

    // Resolve cloudflareUid from DB — never trust client-provided value directly
    const { data: stream } = await admin
      .from("live_streams")
      .select("cloudflare_uid")
      .eq("id", streamId)
      .eq("creator_id", auth.userId)
      .maybeSingle();

    if (!stream?.cloudflare_uid) return { connected: false };

    const status = await getLiveInputStatus(stream.cloudflare_uid);
    return { connected: status.connected };
  } catch {
    return { connected: false };
  }
}
