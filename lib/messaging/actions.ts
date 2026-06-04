"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/get-auth-context";
import {
  canFanMessageCreator,
  canSendMessageInConversation,
} from "@/lib/messaging/access";
import {
  conversationRequestSchema,
  markReadSchema,
  sendMessageSchema,
  startConversationSchema,
} from "@/lib/messaging/schemas";
import { bindUploadToMessage } from "@/lib/media/bind";
import { uploadMessageAttachment } from "@/lib/messaging/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { MediaUploadRow } from "@/types/media";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function revalidateMessagingPaths() {
  revalidatePath("/messages");
  revalidatePath("/creator/messages");
}

export async function startConversationWithCreator(
  input: unknown,
): Promise<ActionResult<{ conversationId: string }>> {
  const parsed = startConversationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid creator",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const allowed = await canFanMessageCreator(
    supabase,
    auth.userId,
    parsed.data.creatorId,
  );
  if (!allowed) {
    return { success: false, error: "Creator not found." };
  }

  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    p_fan_id: auth.userId,
    p_creator_id: parsed.data.creatorId,
    p_initiator_id: auth.userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateMessagingPaths();
  return { success: true, data: { conversationId: data as string } };
}

export async function sendMessage(
  input: unknown,
): Promise<ActionResult<{ messageId: string; createdAt: string }>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select(
      "id, fan_id, creator_id, status, is_blocked_by_creator, is_blocked_by_fan",
    )
    .eq("id", parsed.data.conversationId)
    .maybeSingle();

  if (convError || !conv) {
    return { success: false, error: "Conversation not found." };
  }

  if (conv.fan_id !== auth.userId && conv.creator_id !== auth.userId) {
    return { success: false, error: "Forbidden." };
  }

  const sendCheck = await canSendMessageInConversation(supabase, {
    conversationId: conv.id,
    senderId: auth.userId,
    fanId: conv.fan_id,
    creatorId: conv.creator_id,
    status: conv.status,
    isBlocked: conv.is_blocked_by_creator || conv.is_blocked_by_fan,
  });

  if (!sendCheck.allowed) {
    return { success: false, error: sendCheck.reason ?? "Cannot send message." };
  }

  const createdAt = new Date().toISOString();

  let mediaR2Key = parsed.data.attachmentPath ?? null;
  let mediaUploadId: string | null = parsed.data.mediaUploadId ?? null;
  let attachmentType = parsed.data.attachmentType ?? null;
  let attachmentMime = parsed.data.attachmentMime ?? null;
  let attachmentFilename = parsed.data.attachmentFilename ?? null;
  let attachmentSizeBytes = parsed.data.attachmentSizeBytes ?? null;

  if (parsed.data.mediaUploadId) {
    const { data: uploadRaw } = await supabase
      .from("media_uploads")
      .select("*")
      .eq("id", parsed.data.mediaUploadId)
      .eq("owner_id", auth.userId)
      .eq("context", "message")
      .eq("context_ref_id", parsed.data.conversationId)
      .eq("status", "ready")
      .maybeSingle();

    if (!uploadRaw) {
      return {
        success: false,
        error: "Attachment is not ready. Wait for upload and scan to finish.",
      };
    }

    const upload = uploadRaw as MediaUploadRow;
    mediaR2Key = upload.object_key;
    mediaUploadId = upload.id;
    attachmentMime = upload.mime_type;
    attachmentFilename = upload.original_filename;
    attachmentSizeBytes = upload.byte_size;
    if (upload.mime_type.startsWith("image/")) attachmentType = "image";
    else if (upload.mime_type.startsWith("video/")) attachmentType = "video";
    else if (upload.mime_type.startsWith("audio/")) attachmentType = "audio";
    else attachmentType = "file";
  }

  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_id: auth.userId,
      body: parsed.data.body || null,
      media_r2_key: mediaR2Key,
      media_upload_id: mediaUploadId,
      attachment_type: attachmentType,
      attachment_mime: attachmentMime,
      attachment_filename: attachmentFilename,
      attachment_size_bytes: attachmentSizeBytes,
      created_at: createdAt,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  if (parsed.data.mediaUploadId) {
    const admin = createAdminClient();
    await bindUploadToMessage(admin, {
      uploadId: parsed.data.mediaUploadId,
      messageId: inserted.id,
    });
  }

  const recipientId =
    auth.userId === conv.fan_id ? conv.creator_id : conv.fan_id;

  try {
    const admin = createAdminClient();
    const { notifyNewMessage } = await import("@/lib/notifications/emit");
    await notifyNewMessage(admin, {
      recipientId,
      senderId: auth.userId,
      conversationId: conv.id,
      messageId: inserted.id,
      preview: parsed.data.body ?? "",
    });
  } catch (err) {
    console.error("[notifications] new message", err);
  }

  revalidateMessagingPaths();
  return {
    success: true,
    data: {
      messageId: inserted.id,
      createdAt: inserted.created_at,
    },
  };
}

export async function sendMessageWithAttachment(
  formData: FormData,
): Promise<ActionResult<{ messageId: string }>> {
  const conversationId = formData.get("conversationId");
  const body = formData.get("body");
  const file = formData.get("file");

  if (typeof conversationId !== "string") {
    return { success: false, error: "Missing conversation." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (!(file instanceof File) || file.size === 0) {
    return sendMessage({
      conversationId,
      body: typeof body === "string" ? body : "",
    });
  }

  const uploaded = await uploadMessageAttachment(supabase, {
    conversationId,
    userId: auth.userId,
    file,
  });

  if ("error" in uploaded) {
    return { success: false, error: uploaded.error };
  }

  return sendMessage({
    conversationId,
    body: typeof body === "string" ? body : "",
    attachmentPath: uploaded.storagePath,
    attachmentType: uploaded.attachmentType,
    attachmentMime: uploaded.mime,
    attachmentFilename: uploaded.filename,
    attachmentSizeBytes: uploaded.sizeBytes,
  });
}

export async function markConversationRead(
  input: unknown,
): Promise<ActionResult<{ marked: number }>> {
  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid conversation",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data, error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: parsed.data.conversationId,
    p_user_id: auth.userId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateMessagingPaths();
  return { success: true, data: { marked: (data as number) ?? 0 } };
}

export async function respondToMessageRequest(
  input: unknown,
): Promise<ActionResult> {
  const parsed = conversationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  const status = parsed.data.action === "accept" ? "accepted" : "declined";

  const { error } = await supabase.rpc("set_conversation_request_status", {
    p_conversation_id: parsed.data.conversationId,
    p_actor_id: auth.userId,
    p_status: status,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateMessagingPaths();
  return { success: true };
}
