"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type StoryResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function createStory(input: {
  caption?: string;
  visibility: "public" | "subscribers";
  durationHours?: number;
}): Promise<StoryResult<{ storyId: string }>> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  const duration = Math.min(Math.max(input.durationHours ?? 24, 1), 72);
  const expiresAt = new Date(Date.now() + duration * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from("posts")
    .insert({
      creator_id: auth.userId,
      type: "image",
      caption: input.caption || null,
      visibility: input.visibility,
      status: "published",
      is_story: true,
      expires_at: expiresAt,
      published_at: new Date().toISOString(),
      moderation_status: "pending",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/feed");
  revalidatePath("/creator/content");
  return { success: true, data: { storyId: data.id } };
}

export async function deleteStory(storyId: string): Promise<StoryResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase
    .from("posts")
    .update({ status: "archived" })
    .eq("id", storyId)
    .eq("creator_id", auth.userId)
    .eq("is_story", true);

  if (error) return { success: false, error: error.message };

  revalidatePath("/feed");
  revalidatePath("/creator/content");
  return { success: true };
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  await supabase
    .from("story_views")
    .upsert(
      { story_id: storyId, viewer_id: auth.userId },
      { onConflict: "story_id,viewer_id" },
    );
}
