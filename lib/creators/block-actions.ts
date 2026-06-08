"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type BlockResult =
  | { success: true }
  | { success: false; error: string };

export async function blockCreator(creatorId: string): Promise<BlockResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.userId === creatorId) {
    return { success: false, error: "Cannot block yourself." };
  }

  const admin = createAdminClient();

  const { error: blockError } = await admin
    .from("fan_blocks")
    .upsert({ fan_id: auth.userId, creator_id: creatorId }, { onConflict: "fan_id,creator_id" });

  if (blockError) return { success: false, error: blockError.message };

  // Prevent creator from messaging this fan
  await admin
    .from("conversations")
    .update({ is_blocked_by_fan: true })
    .eq("fan_id", auth.userId)
    .eq("creator_id", creatorId);

  revalidatePath("/feed");
  return { success: true };
}

export async function unblockCreator(creatorId: string): Promise<BlockResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const admin = createAdminClient();

  const { error } = await admin
    .from("fan_blocks")
    .delete()
    .eq("fan_id", auth.userId)
    .eq("creator_id", creatorId);

  if (error) return { success: false, error: error.message };

  // Restore messaging
  await admin
    .from("conversations")
    .update({ is_blocked_by_fan: false })
    .eq("fan_id", auth.userId)
    .eq("creator_id", creatorId);

  revalidatePath("/feed");
  return { success: true };
}

export async function isFanBlockingCreator(
  supabase: SupabaseClient,
  fanId: string,
  creatorId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("fan_blocks")
    .select("fan_id")
    .eq("fan_id", fanId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  return Boolean(data);
}
