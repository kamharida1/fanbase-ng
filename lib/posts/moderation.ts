"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export type ModerationResult =
  | { success: true }
  | { success: false; error: string };

export async function pinPost(postId: string): Promise<ModerationResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  // Verify ownership
  const { data: post } = await supabase
    .from("posts")
    .select("creator_id")
    .eq("id", postId)
    .eq("status", "published")
    .maybeSingle();

  if (!post || post.creator_id !== auth.userId) {
    return { success: false, error: "Post not found or forbidden." };
  }

  // Unpin any currently pinned post for this creator
  await supabase
    .from("posts")
    .update({ is_pinned: false })
    .eq("creator_id", auth.userId)
    .eq("is_pinned", true);

  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: true })
    .eq("id", postId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/creators/${auth.profile.username}`);
  revalidatePath("/creator/content");
  return { success: true };
}

export async function unpinPost(postId: string): Promise<ModerationResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: post } = await supabase
    .from("posts")
    .select("creator_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.creator_id !== auth.userId) {
    return { success: false, error: "Post not found or forbidden." };
  }

  const { error } = await supabase
    .from("posts")
    .update({ is_pinned: false })
    .eq("id", postId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/creators/${auth.profile.username}`);
  revalidatePath("/creator/content");
  return { success: true };
}

export async function deleteComment(
  commentId: string,
): Promise<ModerationResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  // Fetch comment + its post to check ownership
  const { data: comment } = await supabase
    .from("post_comments")
    .select("id, author_id, post_id, posts!inner(creator_id)")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) return { success: false, error: "Comment not found." };

  const postCreatorId = (
    Array.isArray(comment.posts)
      ? comment.posts[0]?.creator_id
      : (comment.posts as { creator_id: string } | null)?.creator_id
  );

  const isAuthor = comment.author_id === auth.userId;
  const isPostCreator = postCreatorId === auth.userId;

  if (!isAuthor && !isPostCreator) {
    return { success: false, error: "Forbidden." };
  }

  const { error } = await supabase
    .from("post_comments")
    .update({ is_deleted: true })
    .eq("id", commentId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/feed");
  return { success: true };
}

export async function pinComment(
  commentId: string,
  postId: string,
): Promise<ModerationResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  // Only the post creator can pin
  const { data: post } = await supabase
    .from("posts")
    .select("creator_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.creator_id !== auth.userId) {
    return { success: false, error: "Forbidden." };
  }

  // Unpin any existing pinned comment on this post
  await supabase
    .from("post_comments")
    .update({ is_pinned: false })
    .eq("post_id", postId)
    .eq("is_pinned", true);

  const { error } = await supabase
    .from("post_comments")
    .update({ is_pinned: true })
    .eq("id", commentId)
    .eq("post_id", postId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/feed");
  return { success: true };
}

export async function hideComment(
  commentId: string,
): Promise<ModerationResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: comment } = await supabase
    .from("post_comments")
    .select("post_id, posts!inner(creator_id)")
    .eq("id", commentId)
    .maybeSingle();

  const postsVal = comment?.posts as unknown as { creator_id: string } | { creator_id: string }[] | null;
  const creatorId = Array.isArray(postsVal) ? postsVal[0]?.creator_id : postsVal?.creator_id;

  if (!comment || creatorId !== auth.userId) {
    return { success: false, error: "Forbidden." };
  }

  const { error } = await supabase
    .from("post_comments")
    .update({ is_hidden_by_creator: true })
    .eq("id", commentId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/feed");
  return { success: true };
}

export async function unhideComment(
  commentId: string,
): Promise<ModerationResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: comment } = await supabase
    .from("post_comments")
    .select("post_id, posts!inner(creator_id)")
    .eq("id", commentId)
    .maybeSingle();

  const postsVal = comment?.posts as unknown as { creator_id: string } | { creator_id: string }[] | null;
  const creatorId = Array.isArray(postsVal) ? postsVal[0]?.creator_id : postsVal?.creator_id;

  if (!comment || creatorId !== auth.userId) {
    return { success: false, error: "Forbidden." };
  }

  const { error } = await supabase
    .from("post_comments")
    .update({ is_hidden_by_creator: false })
    .eq("id", commentId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/feed");
  return { success: true };
}

export async function unpinComment(
  commentId: string,
): Promise<ModerationResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: comment } = await supabase
    .from("post_comments")
    .select("post_id, posts!inner(creator_id)")
    .eq("id", commentId)
    .maybeSingle();

  const postsVal = comment?.posts as unknown as { creator_id: string } | { creator_id: string }[] | null;
  const creatorId = Array.isArray(postsVal)
    ? postsVal[0]?.creator_id
    : postsVal?.creator_id;

  if (!comment || creatorId !== auth.userId) {
    return { success: false, error: "Forbidden." };
  }

  await supabase
    .from("post_comments")
    .update({ is_pinned: false })
    .eq("id", commentId);

  revalidatePath("/feed");
  return { success: true };
}
