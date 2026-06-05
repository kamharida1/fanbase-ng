"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FanActionResult =
  | { success: true }
  | { success: false; error: string };

export async function blockFan(fanId: string): Promise<FanActionResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }
  if (auth.userId === fanId) {
    return { success: false, error: "Cannot block yourself." };
  }

  const admin = createAdminClient();

  // Insert block
  const { error: blockError } = await admin
    .from("creator_blocks")
    .upsert({ creator_id: auth.userId, fan_id: fanId }, { onConflict: "creator_id,fan_id" });

  if (blockError) return { success: false, error: blockError.message };

  // Block messaging in any open conversation
  await admin
    .from("conversations")
    .update({ is_blocked_by_creator: true })
    .eq("creator_id", auth.userId)
    .eq("fan_id", fanId);

  revalidatePath("/creator/fans");
  revalidatePath("/creator/messages");
  return { success: true };
}

export async function unblockFan(fanId: string): Promise<FanActionResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("creator_blocks")
    .delete()
    .eq("creator_id", auth.userId)
    .eq("fan_id", fanId);

  if (error) return { success: false, error: error.message };

  // Restore messaging
  await admin
    .from("conversations")
    .update({ is_blocked_by_creator: false })
    .eq("creator_id", auth.userId)
    .eq("fan_id", fanId);

  revalidatePath("/creator/fans");
  revalidatePath("/creator/messages");
  return { success: true };
}
