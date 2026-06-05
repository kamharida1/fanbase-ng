import type { SupabaseClient } from "@supabase/supabase-js";

import { formatNgnFromKobo } from "@/lib/creators/format";
import {
  creatorLiveEmail,
  newCommentEmail,
  newMessageEmail,
  newSubscriberEmail,
  newTipEmail,
  payoutEmail,
} from "@/lib/email/templates";
import { sendEmailNotification } from "@/lib/email/send";
import { getProfileLabel } from "@/lib/notifications/profiles";
import { createNotification } from "@/lib/notifications/service";
import { buildAppActionUrl } from "@/lib/security/safe-url";

// Helper: fire-and-forget email — never let a send error break in-app notifications
function fireEmail(promise: Promise<void>, tag: string): void {
  promise.catch((err) => console.error(`[email:${tag}]`, err));
}

export async function notifyNewSubscriber(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    fanId: string;
    subscriptionId: string;
    planName: string;
    amountKobo?: number;
  },
): Promise<void> {
  const fanLabel = await getProfileLabel(admin, input.fanId);

  await createNotification(admin, {
    userId: input.creatorId,
    type: "new_subscriber",
    title: "New subscriber",
    body: `${fanLabel} subscribed to ${input.planName}.`,
    actionUrl: buildAppActionUrl("/creator/dashboard"),
    entityType: "subscriptions",
    entityId: input.subscriptionId,
    metadata: { fan_id: input.fanId, plan_name: input.planName },
    idempotencyKey: `subscriber:${input.subscriptionId}`,
  });

  const { subject, html } = newSubscriberEmail({
    creatorName: "",
    fanName: fanLabel,
    planName: input.planName,
    amountKobo: input.amountKobo ?? 0,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.creatorId,
      notificationType: "new_subscriber",
      subject,
      html,
    }),
    "new_subscriber",
  );
}

export async function notifyNewMessage(
  admin: SupabaseClient,
  input: {
    recipientId: string;
    senderId: string;
    conversationId: string;
    messageId: string;
    preview: string;
  },
): Promise<void> {
  if (input.recipientId === input.senderId) return;

  const senderLabel = await getProfileLabel(admin, input.senderId);
  const preview =
    input.preview.trim().slice(0, 120) || "Sent you an attachment";

  await createNotification(admin, {
    userId: input.recipientId,
    type: "new_message",
    title: `Message from ${senderLabel}`,
    body: preview,
    actionUrl: buildAppActionUrl(
      `/messages?conversation=${encodeURIComponent(input.conversationId)}`,
    ),
    entityType: "messages",
    entityId: input.messageId,
    metadata: {
      conversation_id: input.conversationId,
      sender_id: input.senderId,
    },
    idempotencyKey: `message:${input.messageId}`,
  });

  const { subject, html } = newMessageEmail({
    recipientName: "",
    senderName: senderLabel,
    preview,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.recipientId,
      notificationType: "new_message",
      subject,
      html,
    }),
    "new_message",
  );
}

export async function notifyNewComment(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    authorId: string;
    postId: string;
    commentId: string;
    body: string;
  },
): Promise<void> {
  if (input.creatorId === input.authorId) return;

  const authorLabel = await getProfileLabel(admin, input.authorId);

  await createNotification(admin, {
    userId: input.creatorId,
    type: "new_comment",
    title: "New comment",
    body: `${authorLabel}: ${input.body.trim().slice(0, 100)}`,
    actionUrl: buildAppActionUrl("/feed"),
    entityType: "post_comments",
    entityId: input.commentId,
    metadata: { post_id: input.postId, author_id: input.authorId },
    idempotencyKey: `comment:${input.commentId}`,
  });

  const { subject, html } = newCommentEmail({
    creatorName: "",
    authorName: authorLabel,
    commentBody: input.body,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.creatorId,
      notificationType: "new_comment",
      subject,
      html,
    }),
    "new_comment",
  );
}

export async function notifyNewLike(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    fanId: string;
    postId: string;
  },
): Promise<void> {
  if (input.creatorId === input.fanId) return;

  const fanLabel = await getProfileLabel(admin, input.fanId);

  await createNotification(admin, {
    userId: input.creatorId,
    type: "new_like",
    title: "New like",
    body: `${fanLabel} liked your post.`,
    actionUrl: buildAppActionUrl("/feed"),
    entityType: "posts",
    entityId: input.postId,
    metadata: { fan_id: input.fanId },
    idempotencyKey: `like:${input.postId}:${input.fanId}`,
  });
  // Likes are high-volume — email not sent to avoid inbox flooding
}

export async function notifyNewTip(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    fanId: string;
    amountKobo: number;
    paymentId: string;
  },
): Promise<void> {
  const fanLabel = await getProfileLabel(admin, input.fanId);
  const amount = formatNgnFromKobo(input.amountKobo);

  await createNotification(admin, {
    userId: input.creatorId,
    type: "new_tip",
    title: "New tip received",
    body: `${fanLabel} sent you a ${amount} tip.`,
    actionUrl: buildAppActionUrl("/creator/earnings"),
    entityType: "payments",
    entityId: input.paymentId,
    metadata: { fan_id: input.fanId, amount_kobo: input.amountKobo },
    idempotencyKey: `tip:${input.paymentId}`,
  });

  const { subject, html } = newTipEmail({
    creatorName: "",
    fanName: fanLabel,
    amountKobo: input.amountKobo,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.creatorId,
      notificationType: "new_tip",
      subject,
      html,
    }),
    "new_tip",
  );
}

export async function notifyCreatorLive(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    streamId: string;
    title: string;
  },
): Promise<void> {
  // Fetch creator profile for display name + username
  const { data: creatorProfile } = await admin
    .from("profiles")
    .select("username, display_name")
    .eq("id", input.creatorId)
    .maybeSingle();

  const creatorLabel =
    creatorProfile?.display_name ?? creatorProfile?.username ?? "Creator";
  const creatorUsername = creatorProfile?.username ?? input.creatorId;

  // Fetch up to 100 active subscribers
  const { data: subs } = await admin
    .from("subscriptions")
    .select("fan_id")
    .eq("creator_id", input.creatorId)
    .in("status", ["active", "trialing"])
    .limit(100);

  if (!subs?.length) return;

  const { subject, html } = creatorLiveEmail({
    fanName: "",
    creatorName: creatorLabel,
    creatorUsername,
    streamTitle: input.title,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      await createNotification(admin, {
        userId: sub.fan_id,
        type: "creator_live",
        title: `${creatorLabel} is live now`,
        body: input.title,
        actionUrl: buildAppActionUrl(`/creators/${creatorUsername}`),
        entityType: "live_streams",
        entityId: input.streamId,
        metadata: { creator_id: input.creatorId },
        idempotencyKey: `live:${input.streamId}:${sub.fan_id}`,
      });

      fireEmail(
        sendEmailNotification(admin, {
          userId: sub.fan_id,
          notificationType: "creator_live",
          subject,
          html,
        }),
        "creator_live",
      );
    }),
  );
}

export async function notifyNewPayout(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    payoutRequestId: string;
    amountKobo: number;
  },
): Promise<void> {
  const amount = formatNgnFromKobo(input.amountKobo);

  await createNotification(admin, {
    userId: input.creatorId,
    type: "new_payout",
    title: "Payout requested",
    body: `Your withdrawal of ${amount} has been submitted.`,
    actionUrl: buildAppActionUrl("/creator/withdrawals"),
    entityType: "payout_requests",
    entityId: input.payoutRequestId,
    metadata: { amount_kobo: input.amountKobo },
    idempotencyKey: `payout:${input.payoutRequestId}`,
  });

  const { subject, html } = payoutEmail({
    creatorName: "",
    amountKobo: input.amountKobo,
    status: "requested",
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.creatorId,
      notificationType: "new_payout",
      subject,
      html,
    }),
    "new_payout",
  );
}
