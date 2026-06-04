import type { SupabaseClient } from "@supabase/supabase-js";

import type { MediaUploadContext } from "@/types/media";

export async function assertCanUploadToContext(
  supabase: SupabaseClient,
  input: {
    userId: string;
    context: MediaUploadContext;
    contextRefId: string;
    isCreator: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, context, contextRefId, isCreator } = input;

  if (context === "post") {
    if (!isCreator) {
      return { ok: false, error: "Creator account required for post media." };
    }
    const { data: post } = await supabase
      .from("posts")
      .select("id")
      .eq("id", contextRefId)
      .eq("creator_id", userId)
      .maybeSingle();

    if (!post) return { ok: false, error: "Post not found." };
    return { ok: true };
  }

  if (context === "message") {
    const { data: allowed } = await supabase.rpc("is_conversation_participant", {
      p_user_id: userId,
      p_conversation_id: contextRefId,
    });

    if (!allowed) {
      return { ok: false, error: "You are not in this conversation." };
    }
    return { ok: true };
  }

  if (context === "profile") {
    if (contextRefId !== userId) {
      return { ok: false, error: "Profile uploads must target your own account." };
    }
    return { ok: true };
  }

  return { ok: false, error: "Invalid upload context." };
}
