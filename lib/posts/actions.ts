"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { getAccountAge } from "@/lib/auth/account-age";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { extractHashtags } from "@/lib/posts/hashtags";
import {
  commentSchema,
  likePostSchema,
  ngnToKobo,
  upsertPostSchema,
  votePollSchema,
} from "@/lib/posts/schemas";
import { uploadPostMediaFile } from "@/lib/posts/storage";
import { feedCacheTag } from "@/lib/feed/queries";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

async function attachPollIfMissing(
  supabase: SupabaseClient,
  postId: string,
  poll: { question: string; options: string[]; closesInHours?: number } | null | undefined,
) {
  if (!poll) return;

  const { data: existing } = await supabase
    .from("post_polls")
    .select("id")
    .eq("post_id", postId)
    .maybeSingle();
  if (existing) return;

  const closesAt = poll.closesInHours
    ? new Date(Date.now() + poll.closesInHours * 60 * 60 * 1000).toISOString()
    : null;

  const { data: pollRow, error: pollError } = await supabase
    .from("post_polls")
    .insert({ post_id: postId, question: poll.question, closes_at: closesAt })
    .select("id")
    .single();
  if (pollError || !pollRow) return;

  await supabase.from("poll_options").insert(
    poll.options.map((label, index) => ({
      poll_id: pollRow.id,
      label,
      sort_order: index,
    })),
  );
}

function revalidatePostPaths(userId?: string) {
  revalidatePath("/creator/content");
  revalidatePath("/feed");
  revalidatePath("/discover");
  if (userId) {
    revalidateTag(feedCacheTag(userId));
  }
}

export async function savePost(
  input: unknown,
): Promise<ActionResult<{ postId: string }>> {
  const parsed = upsertPostSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid post",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  // Rate-limit new post publishes. Drafts and edits are exempt.
  const isNewPost = !parsed.data.postId;
  const isPublishing = parsed.data.publishNow === true;
  if (isNewPost && isPublishing) {
    const { isNew: accountIsNew } = await getAccountAge(supabase, auth.userId);
    const postRl = await checkRateLimit(
      `postCreate:${auth.userId}`,
      accountIsNew ? RATE_LIMITS.postCreateNewAccount : RATE_LIMITS.postCreate,
    );
    if (!postRl.ok) {
      return {
        success: false,
        error: `You're publishing too quickly. Try again in ${postRl.retryAfterSeconds}s.`,
      };
    }
  }

  const ppvKobo =
    parsed.data.ppvPriceNgn != null
      ? ngnToKobo(parsed.data.ppvPriceNgn)
      : null;

  const publishNow = parsed.data.publishNow === true;
  const scheduledAt = parsed.data.scheduledAt;

  let status: "draft" | "published" = "draft";
  let publishedAt: string | null = null;
  let scheduledPublishAt: string | null = scheduledAt ?? null;

  if (publishNow) {
    status = "published";
    publishedAt = new Date().toISOString();
    scheduledPublishAt = null;
  } else if (scheduledAt && new Date(scheduledAt) > new Date()) {
    status = "draft";
    scheduledPublishAt = scheduledAt;
  }

  const payload = {
    creator_id: auth.userId,
    type: parsed.data.type,
    caption: parsed.data.caption || null,
    hashtags: extractHashtags(parsed.data.caption),
    content_warning: parsed.data.contentWarning || null,
    visibility: parsed.data.visibility,
    plan_id: parsed.data.visibility === "tier" ? parsed.data.planId : null,
    ppv_price_kobo: parsed.data.visibility === "ppv" ? ppvKobo : null,
    status,
    published_at: publishedAt,
    scheduled_publish_at: scheduledPublishAt,
    moderation_status: status === "published" ? "pending" : "pending",
  };

  if (parsed.data.postId) {
    const { error } = await supabase
      .from("posts")
      .update(payload)
      .eq("id", parsed.data.postId)
      .eq("creator_id", auth.userId);

  if (error) return { success: false, error: error.message };
  await attachPollIfMissing(supabase, parsed.data.postId, parsed.data.poll);
  revalidatePostPaths(auth.userId);
  return { success: true, data: { postId: parsed.data.postId } };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  await attachPollIfMissing(supabase, data.id, parsed.data.poll);
  revalidatePostPaths(auth.userId);
  return { success: true, data: { postId: data.id } };
}

export async function uploadPostMedia(
  formData: FormData,
): Promise<ActionResult<{ mediaId: string }>> {
  const postId = formData.get("postId");
  const file = formData.get("file");
  const sortOrder = parseInt(String(formData.get("sortOrder") ?? "0"), 10);

  if (typeof postId !== "string" || !(file instanceof File)) {
    return { success: false, error: "Invalid upload." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: post } = await supabase
    .from("posts")
    .select("id, creator_id, type")
    .eq("id", postId)
    .eq("creator_id", auth.userId)
    .maybeSingle();

  if (!post) return { success: false, error: "Post not found." };

  const uploaded = await uploadPostMediaFile(supabase, {
    postId,
    creatorId: auth.userId,
    file,
    sortOrder,
  });

  if ("error" in uploaded) {
    return { success: false, error: uploaded.error };
  }

  const { data, error } = await supabase
    .from("post_media")
    .insert({
      post_id: postId,
      media_type: uploaded.mediaType,
      r2_key: uploaded.r2Key,
      byte_size: uploaded.byteSize,
      sort_order: sortOrder,
      processing_status: "ready",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  if (post.type === "text") {
    await supabase
      .from("posts")
      .update({ type: uploaded.mediaType })
      .eq("id", postId);
  }

  revalidatePostPaths(auth.userId);
  return { success: true, data: { mediaId: data.id } };
}

export async function archivePost(postId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase
    .from("posts")
    .update({ status: "archived" })
    .eq("id", postId)
    .eq("creator_id", auth.userId);

  if (error) return { success: false, error: error.message };
  revalidatePostPaths(auth.userId);
  return { success: true };
}

export async function togglePostLike(
  input: unknown,
): Promise<ActionResult<{ liked: boolean }>> {
  const parsed = likePostSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid post" };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: existing } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", parsed.data.postId)
    .eq("fan_id", auth.userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", parsed.data.postId)
      .eq("fan_id", auth.userId);
    revalidatePostPaths(auth.userId);
    return { success: true, data: { liked: false } };
  }

  const { error } = await supabase.from("post_likes").insert({
    fan_id: auth.userId,
    post_id: parsed.data.postId,
  });

  if (error) return { success: false, error: error.message };

  const { data: post } = await supabase
    .from("posts")
    .select("creator_id")
    .eq("id", parsed.data.postId)
    .maybeSingle();

  if (post?.creator_id) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { notifyNewLike } = await import("@/lib/notifications/emit");
      const admin = createAdminClient();
      await notifyNewLike(admin, {
        creatorId: post.creator_id,
        fanId: auth.userId,
        postId: parsed.data.postId,
      });
    } catch (err) {
      console.error("[notifications] new like", err);
    }
  }

  revalidatePostPaths(auth.userId);
  return { success: true, data: { liked: true } };
}

export async function votePoll(
  input: unknown,
): Promise<ActionResult<{ optionId: string }>> {
  const parsed = votePollSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid vote." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase.from("poll_votes").insert({
    poll_id: parsed.data.pollId,
    option_id: parsed.data.optionId,
    voter_id: auth.userId,
  });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "You've already voted on this poll." };
    }
    return { success: false, error: "Couldn't record your vote. The poll may be closed." };
  }

  revalidatePostPaths();
  return { success: true, data: { optionId: parsed.data.optionId } };
}

export async function addPostComment(
  input: unknown,
): Promise<ActionResult<{ commentId: string }>> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid comment",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: parsed.data.postId,
      author_id: auth.userId,
      body: parsed.data.body,
      parent_id: parsed.data.parentId ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  const { data: post } = await supabase
    .from("posts")
    .select("creator_id")
    .eq("id", parsed.data.postId)
    .maybeSingle();

  if (post?.creator_id) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { notifyNewComment } = await import("@/lib/notifications/emit");
      const admin = createAdminClient();
      await notifyNewComment(admin, {
        creatorId: post.creator_id,
        authorId: auth.userId,
        postId: parsed.data.postId,
        commentId: data.id,
        body: parsed.data.body,
      });
    } catch (err) {
      console.error("[notifications] new comment", err);
    }
  }

  revalidatePostPaths(auth.userId);
  return { success: true, data: { commentId: data.id } };
}
