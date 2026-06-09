import type { SupabaseClient } from "@supabase/supabase-js";

import { formatNgnFromKobo } from "@/lib/creators/format";
import {
  accountDeletionEmail,
  accountStatusEmail,
  appealResolvedEmail,
  copyrightAutoRemovedEmail,
  copyrightClaimReceivedEmail,
  copyrightCounterNoticeAcknowledgedEmail,
  creatorLiveEmail,
  giftSubscriptionEmail,
  kycDecisionEmail,
  missedCallEmail,
  newCommentEmail,
  newMessageEmail,
  newPostEmail,
  newSubscriberEmail,
  newTipEmail,
  paymentDisputeEmail,
  payoutEmail,
  subscriptionEndedEmail,
  subscriptionPaymentFailedEmail,
  winBackEmail,
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

export async function notifyGiftSubscription(
  admin: SupabaseClient,
  input: {
    recipientId: string;
    gifterId: string;
    creatorId: string;
    planName: string;
    months: number;
    subscriptionId: string;
  },
): Promise<void> {
  const [gifterLabel, creatorLabel] = await Promise.all([
    getProfileLabel(admin, input.gifterId),
    getProfileLabel(admin, input.creatorId),
  ]);

  const monthsLabel = input.months === 1 ? "1 month" : `${input.months} months`;

  await createNotification(admin, {
    userId: input.recipientId,
    type: "gift_subscription",
    title: "You received a gift subscription!",
    body: `${gifterLabel} gifted you ${monthsLabel} of ${creatorLabel}'s ${input.planName} plan.`,
    actionUrl: buildAppActionUrl("/subscriptions"),
    entityType: "subscriptions",
    entityId: input.subscriptionId,
    metadata: {
      gifter_id: input.gifterId,
      creator_id: input.creatorId,
      plan_name: input.planName,
      months: input.months,
    },
    idempotencyKey: `gift_subscription:${input.subscriptionId}`,
  });

  const { subject, html } = giftSubscriptionEmail({
    gifterName: gifterLabel,
    creatorName: creatorLabel,
    planName: input.planName,
    months: input.months,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.recipientId,
      notificationType: "gift_subscription",
      subject,
      html,
    }),
    "gift_subscription",
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

export async function notifyScheduledPostPublished(
  admin: SupabaseClient,
  input: {
    postId: string;
    creatorId: string;
    caption: string;
  },
): Promise<void> {
  const { data: creatorProfile } = await admin
    .from("profiles")
    .select("username, display_name")
    .eq("id", input.creatorId)
    .maybeSingle();

  const creatorLabel =
    creatorProfile?.display_name ?? creatorProfile?.username ?? "Creator";
  const creatorUsername = creatorProfile?.username ?? input.creatorId;

  const { data: subs } = await admin
    .from("subscriptions")
    .select("fan_id")
    .eq("creator_id", input.creatorId)
    .in("status", ["active", "trialing"])
    .limit(500);

  if (!subs?.length) return;

  const { subject, html } = newPostEmail({
    fanName: "",
    creatorName: creatorLabel,
    creatorUsername,
    postCaption: input.caption,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      await createNotification(admin, {
        userId: sub.fan_id,
        type: "new_post",
        title: `New post from ${creatorLabel}`,
        body: input.caption.trim().slice(0, 120) || "New post",
        actionUrl: buildAppActionUrl(`/creators/${creatorUsername}`),
        entityType: "posts",
        entityId: input.postId,
        metadata: { creator_id: input.creatorId },
        idempotencyKey: `new_post:${input.postId}:${sub.fan_id}`,
      });

      fireEmail(
        sendEmailNotification(admin, {
          userId: sub.fan_id,
          notificationType: "new_post",
          subject,
          html,
        }),
        "new_post",
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

export async function notifyPayoutProcessed(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    payoutRequestId: string;
  },
): Promise<void> {
  await createNotification(admin, {
    userId: input.creatorId,
    type: "new_payout",
    title: "Payout sent",
    body: "Your withdrawal has been sent to your bank account.",
    actionUrl: buildAppActionUrl("/creator/withdrawals"),
    entityType: "payout_requests",
    entityId: input.payoutRequestId,
    idempotencyKey: `payout:${input.payoutRequestId}:completed`,
  });
}

export async function notifyPaymentDispute(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    disputeId: string;
    status: "opened" | "won" | "lost" | "closed";
    amountKobo: number;
  },
): Promise<void> {
  const amount = formatNgnFromKobo(input.amountKobo);

  const titleMap = {
    opened: "Payment dispute opened",
    won: "Dispute resolved in your favor",
    lost: "Dispute resolved against you",
    closed: "Payment dispute closed",
  };

  const bodyMap = {
    opened: `A fan disputed a payment of ${amount}. The earnings have been placed on hold until it's resolved.`,
    won: `Good news — you won the dispute over ${amount}. The held funds have been released to your wallet.`,
    lost: `The dispute over ${amount} was resolved against you. The held funds have been deducted and the subscriber's access revoked.`,
    closed: `The dispute over ${amount} was closed. The held funds have been released to your wallet.`,
  };

  await createNotification(admin, {
    userId: input.creatorId,
    type: "payment_dispute",
    title: titleMap[input.status],
    body: bodyMap[input.status],
    actionUrl: buildAppActionUrl("/creator/analytics"),
    entityType: "disputes",
    entityId: input.disputeId,
    metadata: { amount_kobo: input.amountKobo, status: input.status },
    idempotencyKey: `dispute:${input.disputeId}:${input.status}`,
  });

  const { subject, html } = paymentDisputeEmail({
    status: input.status,
    amountKobo: input.amountKobo,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.creatorId,
      notificationType: "payment_dispute",
      subject,
      html,
    }),
    "payment_dispute",
  );
}

export async function notifyAccountStatusChange(
  admin: SupabaseClient,
  input: {
    userId: string;
    status: "suspended" | "banned" | "active";
  },
): Promise<void> {
  const titleMap = {
    suspended: "Your account has been suspended",
    banned: "Your account has been banned",
    active: "Your account has been reinstated",
  };

  const bodyMap = {
    suspended:
      "Your account was suspended for violating our community guidelines. You can submit an appeal if you believe this is a mistake.",
    banned:
      "Your account was permanently banned for violating our community guidelines. You can submit an appeal if you believe this is a mistake.",
    active: "Your account is active again — welcome back.",
  };

  await createNotification(admin, {
    userId: input.userId,
    type: "account_status",
    title: titleMap[input.status],
    body: bodyMap[input.status],
    actionUrl: buildAppActionUrl(input.status === "active" ? "/feed" : "/appeal"),
    entityType: "profiles",
    entityId: input.userId,
    metadata: { status: input.status },
    idempotencyKey: `account_status:${input.userId}:${input.status}:${Date.now()}`,
  });

  const { subject, html } = accountStatusEmail({ status: input.status });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.userId,
      notificationType: "account_status",
      subject,
      html,
    }),
    "account_status",
  );
}

export async function notifyAppealResolved(
  admin: SupabaseClient,
  input: {
    userId: string;
    appealId: string;
    outcome: "approved" | "denied";
    notes?: string | null;
  },
): Promise<void> {
  const titleMap = {
    approved: "Your appeal was approved",
    denied: "Your appeal was denied",
  };

  const bodyMap = {
    approved: "We've reviewed your appeal and reinstated your account.",
    denied:
      "We've reviewed your appeal and decided to uphold the original decision on your account.",
  };

  await createNotification(admin, {
    userId: input.userId,
    type: "appeal_update",
    title: titleMap[input.outcome],
    body: bodyMap[input.outcome],
    actionUrl: buildAppActionUrl(input.outcome === "approved" ? "/feed" : "/appeal"),
    entityType: "account_appeals",
    entityId: input.appealId,
    metadata: { outcome: input.outcome },
    idempotencyKey: `appeal:${input.appealId}:${input.outcome}`,
  });

  const { subject, html } = appealResolvedEmail({
    outcome: input.outcome,
    notes: input.notes,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.userId,
      notificationType: "appeal_update",
      subject,
      html,
    }),
    "appeal_update",
  );
}

export async function notifySubscriptionPastDue(
  admin: SupabaseClient,
  input: {
    fanId: string;
    creatorId: string;
    subscriptionId: string;
    planName: string;
    graceEndsAt: Date;
  },
): Promise<void> {
  const creatorName = await getProfileLabel(admin, input.creatorId);
  const deadline = input.graceEndsAt.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
  });

  await createNotification(admin, {
    userId: input.fanId,
    type: "payment_failed",
    title: "Renewal payment failed",
    body: `We couldn't renew your ${input.planName} subscription to ${creatorName}. Update your payment method by ${deadline} to keep your access.`,
    actionUrl: buildAppActionUrl("/subscriptions"),
    entityType: "subscriptions",
    entityId: input.subscriptionId,
    metadata: { creator_id: input.creatorId, plan_name: input.planName },
    idempotencyKey: `subscription_past_due:${input.subscriptionId}:${input.graceEndsAt.toISOString().slice(0, 10)}`,
  });

  const { subject, html } = subscriptionPaymentFailedEmail({
    creatorName,
    planName: input.planName,
    graceEndsAt: input.graceEndsAt,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.fanId,
      notificationType: "payment_failed",
      subject,
      html,
    }),
    "payment_failed",
  );
}

export async function notifySubscriptionEndedFromNonPayment(
  admin: SupabaseClient,
  input: {
    fanId: string;
    creatorId: string;
    subscriptionId: string;
    planName: string;
  },
): Promise<void> {
  const creatorName = await getProfileLabel(admin, input.creatorId);

  await createNotification(admin, {
    userId: input.fanId,
    type: "subscription_ended",
    title: "Subscription ended",
    body: `Your ${input.planName} subscription to ${creatorName} has ended because we couldn't process your payment.`,
    actionUrl: buildAppActionUrl("/subscriptions"),
    entityType: "subscriptions",
    entityId: input.subscriptionId,
    metadata: { creator_id: input.creatorId, plan_name: input.planName, reason: "payment_failed" },
    idempotencyKey: `subscription_ended:${input.subscriptionId}`,
  });

  const { subject, html } = subscriptionEndedEmail({
    creatorName,
    planName: input.planName,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.fanId,
      notificationType: "subscription_ended",
      subject,
      html,
    }),
    "subscription_ended",
  );
}

export async function notifyWinBackReminder(
  admin: SupabaseClient,
  input: {
    fanId: string;
    creatorId: string;
    creatorUsername: string;
    subscriptionId: string;
    planName: string;
  },
): Promise<void> {
  const creatorName = await getProfileLabel(admin, input.creatorId);

  await createNotification(admin, {
    userId: input.fanId,
    type: "resubscribe_reminder",
    title: "We miss you",
    body: `Your ${input.planName} subscription to ${creatorName} ended a little while ago. Resubscribe any time to pick up where you left off.`,
    actionUrl: buildAppActionUrl(`/creators/${input.creatorUsername}`),
    entityType: "subscriptions",
    entityId: input.subscriptionId,
    metadata: { creator_id: input.creatorId, plan_name: input.planName },
    idempotencyKey: `winback:${input.subscriptionId}`,
  });

  const { subject, html } = winBackEmail({
    creatorName,
    creatorUsername: input.creatorUsername,
    planName: input.planName,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.fanId,
      notificationType: "resubscribe_reminder",
      subject,
      html,
    }),
    "resubscribe_reminder",
  );
}

export async function notifyAccountDeletion(
  admin: SupabaseClient,
  input: {
    userId: string;
    stage: "scheduled" | "cancelled" | "completed";
    scheduledFor?: Date;
  },
): Promise<void> {
  const titleMap = {
    scheduled: "Account deletion scheduled",
    cancelled: "Account deletion cancelled",
    completed: "Your account has been deleted",
  };

  const bodyMap = {
    scheduled: input.scheduledFor
      ? `Your account is scheduled for permanent deletion on ${input.scheduledFor.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}. You can cancel this any time before then from Settings.`
      : "Your account is scheduled for permanent deletion. You can cancel this any time before then from Settings.",
    cancelled: "You cancelled your scheduled account deletion — your account remains active.",
    completed: "Your account and personal information have been permanently removed.",
  };

  // Account is being/has been deleted — only the "scheduled"/"cancelled" stages
  // can usefully notify in-app (the user can still see notifications). The
  // "completed" stage only sends an email since the account no longer exists.
  if (input.stage !== "completed") {
    await createNotification(admin, {
      userId: input.userId,
      type: "account_deletion",
      title: titleMap[input.stage],
      body: bodyMap[input.stage],
      actionUrl: buildAppActionUrl("/settings"),
      entityType: "profiles",
      entityId: input.userId,
      metadata: { stage: input.stage },
      idempotencyKey: `account_deletion:${input.userId}:${input.stage}:${Date.now()}`,
    });
  }

  const { subject, html } = accountDeletionEmail({ stage: input.stage, scheduledFor: input.scheduledFor });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.userId,
      notificationType: "account_deletion",
      subject,
      html,
    }),
    "account_deletion",
  );
}

export async function notifyMissedCall(
  admin: SupabaseClient,
  input: {
    calleeId: string;
    callerId: string;
    conversationId: string;
    callId: string;
    callType: "voice" | "video";
  },
): Promise<void> {
  const callerLabel = await getProfileLabel(admin, input.callerId);
  const kind = input.callType === "video" ? "video call" : "voice call";

  await createNotification(admin, {
    userId: input.calleeId,
    type: "missed_call",
    title: `Missed ${kind}`,
    body: `${callerLabel} tried to reach you with a ${kind}.`,
    actionUrl: buildAppActionUrl("/messages"),
    entityType: "calls",
    entityId: input.callId,
    metadata: {
      conversation_id: input.conversationId,
      caller_id: input.callerId,
      call_type: input.callType,
    },
    idempotencyKey: `missed_call:${input.callId}`,
  });

  const { subject, html } = missedCallEmail({
    callerName: callerLabel,
    callType: input.callType,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.calleeId,
      notificationType: "missed_call",
      subject,
      html,
    }),
    "missed_call",
  );
}

export async function notifyKycDecision(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    outcome: "approved" | "rejected";
    rejectionReason?: string | null;
  },
): Promise<void> {
  const title =
    input.outcome === "approved"
      ? "Your creator verification was approved"
      : "Your verification request was not approved";
  const body =
    input.outcome === "approved"
      ? "Congratulations — your account is now verified. Your badge is visible on your profile."
      : input.rejectionReason
        ? `Your request was not approved: ${input.rejectionReason}. You can reapply from your profile.`
        : "Your request was not approved. You can update your submission and reapply from your profile.";

  await createNotification(admin, {
    userId: input.creatorId,
    type: "account_status",
    title,
    body,
    actionUrl: buildAppActionUrl("/creator/profile"),
    entityType: "profiles",
    entityId: input.creatorId,
    metadata: { kyc_outcome: input.outcome },
    idempotencyKey: `kyc_decision:${input.creatorId}:${input.outcome}:${Date.now()}`,
  });

  const { subject, html } = kycDecisionEmail({
    outcome: input.outcome,
    rejectionReason: input.rejectionReason,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.creatorId,
      notificationType: "account_status",
      subject,
      html,
    }),
    "account_status",
  );
}

export async function notifyCopyrightClaim(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    creatorName: string;
    postId: string;
    postTitle: string;
    claimId: string;
    deadlineDate: string;
  },
): Promise<void> {
  await createNotification(admin, {
    userId: input.creatorId,
    type: "copyright_claim",
    title: "Copyright claim filed against your post",
    body: `A copyright claim has been filed for "${input.postTitle}". You have until ${input.deadlineDate} to dispute it.`,
    actionUrl: buildAppActionUrl("/creator/content"),
    entityType: "copyright_claims",
    entityId: input.claimId,
    metadata: { post_id: input.postId, claim_id: input.claimId },
    idempotencyKey: `copyright_claim:${input.claimId}`,
  });

  const { subject, html } = copyrightClaimReceivedEmail({
    creatorName: input.creatorName,
    postTitle: input.postTitle,
    claimId: input.claimId,
    deadlineDate: input.deadlineDate,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.creatorId,
      notificationType: "copyright_claim",
      subject,
      html,
    }),
    "copyright_claim",
  );
}

export async function notifyCopyrightAutoRemoved(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    creatorName: string;
    postTitle: string;
    claimId: string;
  },
): Promise<void> {
  await createNotification(admin, {
    userId: input.creatorId,
    type: "copyright_claim",
    title: "Post removed: copyright claim",
    body: `Your post "${input.postTitle}" was removed because a copyright claim was not disputed within the 14-day window.`,
    actionUrl: buildAppActionUrl("/creator/content"),
    entityType: "copyright_claims",
    entityId: input.claimId,
    metadata: { claim_id: input.claimId },
    idempotencyKey: `copyright_auto_removed:${input.claimId}`,
  });

  const { subject, html } = copyrightAutoRemovedEmail({
    creatorName: input.creatorName,
    postTitle: input.postTitle,
  });
  fireEmail(
    sendEmailNotification(admin, {
      userId: input.creatorId,
      notificationType: "copyright_claim",
      subject,
      html,
    }),
    "copyright_auto_removed",
  );
}

export async function notifyCounterNoticeToClaimant(
  _admin: SupabaseClient,
  input: {
    claimantEmail: string;
    postTitle: string;
    counterBody: string;
  },
): Promise<void> {
  const { subject, html } = copyrightCounterNoticeAcknowledgedEmail({
    claimantEmail: input.claimantEmail,
    postTitle: input.postTitle,
    counterBody: input.counterBody,
  });
  // Claimant may not be a platform user — send directly via email, no in-app row.
  const { sendTransactionalEmail } = await import("@/lib/email/send");
  fireEmail(
    sendTransactionalEmail({ to: input.claimantEmail, subject, html }),
    "counter_notice_claimant",
  );
}
