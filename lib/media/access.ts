import type { SupabaseClient } from "@supabase/supabase-js";

import type { MediaUploadContext, MediaUploadRow } from "@/types/media";

export async function canDeliverMedia(
  supabase: SupabaseClient,
  input: {
    viewerId: string | null;
    context: MediaUploadContext;
    contextRefId: string;
    ownerId: string;
    /** For post context — post id (same as contextRefId usually) */
    postId?: string;
    /** For message — message row id when checking PPV */
    messageId?: string;
  },
): Promise<boolean> {
  const { viewerId, context, contextRefId, ownerId } = input;

  if (viewerId === ownerId) return true;

  if (context === "profile") {
    return true;
  }

  if (context === "post") {
    const postId = input.postId ?? contextRefId;
    const { data } = await supabase.rpc("can_view_post", {
      p_user_id: viewerId,
      p_post_id: postId,
    });
    return Boolean(data);
  }

  if (context === "message") {
    if (!viewerId) return false;

    const { data: participant } = await supabase.rpc(
      "is_conversation_participant",
      {
        p_user_id: viewerId,
        p_conversation_id: contextRefId,
      },
    );

    if (!participant) return false;

    if (input.messageId) {
      const { data: msg } = await supabase
        .from("messages")
        .select("is_ppv, sender_id")
        .eq("id", input.messageId)
        .maybeSingle();

      if (msg?.is_ppv && msg.sender_id !== viewerId) {
        const { data: purchase } = await supabase
          .from("message_purchases")
          .select("id")
          .eq("message_id", input.messageId)
          .eq("fan_id", viewerId)
          .maybeSingle();
        return Boolean(purchase);
      }
    }

    return true;
  }

  return false;
}

export async function canDeliverByObjectKey(
  supabase: SupabaseClient,
  input: {
    viewerId: string | null;
    objectKey: string | null;
    streamUid: string | null;
  },
): Promise<MediaUploadRow | null> {
  let query = supabase
    .from("media_uploads")
    .select("*")
    .eq("status", "ready");

  if (input.objectKey) {
    query = query.eq("object_key", input.objectKey);
  } else if (input.streamUid) {
    query = query.eq("stream_uid", input.streamUid);
  } else {
    return null;
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;

  const upload = data as MediaUploadRow;
  const allowed = await canDeliverMedia(supabase, {
    viewerId: input.viewerId,
    context: upload.context,
    contextRefId: upload.context_ref_id,
    ownerId: upload.owner_id,
    postId: upload.context === "post" ? upload.context_ref_id : undefined,
  });

  return allowed ? upload : null;
}
