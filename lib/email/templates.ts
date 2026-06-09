import { UNSUBSCRIBE_PLACEHOLDER } from "@/lib/email/unsubscribe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fanbaseng.com";
const SETTINGS_URL = `${APP_URL}/settings`;

function shell(opts: {
  title: string;
  body: string;
  cta?: { label: string; url: string };
}): string {
  const ctaBlock = opts.cta
    ? `<tr>
        <td style="padding:0 40px 32px;">
          <a href="${opts.cta.url}"
             style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;
                    font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
            ${opts.cta.label}
          </a>
        </td>
       </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f5f5f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      max-width:560px;width:100%;">
          <tr>
            <td style="padding:28px 40px 20px;border-bottom:1px solid #f0f0f0;">
              <span style="font-size:18px;font-weight:700;color:#0a0a0a;">Fanbase NG</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              ${opts.body}
            </td>
          </tr>
          ${ctaBlock}
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#999999;line-height:1.6;">
                You received this because email notifications are enabled on your Fanbase NG account.
                <a href="${SETTINGS_URL}" style="color:#999999;">Update preferences</a>
                &nbsp;·&nbsp;
                <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color:#999999;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0a0a0a;line-height:1.3;">${text}</h1>`;
}

function p(text: string) {
  return `<p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">${text}</p>`;
}

function amount(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(kobo / 100);
}

// ── Event templates ────────────────────────────────────────────────────────

export function welcomeEmail(displayName: string): { subject: string; html: string } {
  return {
    subject: `Welcome to Fanbase NG, ${displayName}!`,
    html: shell({
      title: "Welcome to Fanbase NG",
      body: `
        ${h1(`Welcome, ${displayName}!`)}
        ${p("You're now part of Nigeria's creator economy. Whether you're here to support your favourite creators or to build your own audience, we're glad you're here.")}
        ${p("If you want to earn from your content, set up your creator profile and publish your first post — it only takes a few minutes.")}
      `,
      cta: { label: "Get started", url: `${APP_URL}/feed` },
    }),
  };
}

export function newSubscriberEmail(opts: {
  creatorName: string;
  fanName: string;
  planName: string;
  amountKobo: number;
}): { subject: string; html: string } {
  return {
    subject: `New subscriber: ${opts.fanName} joined ${opts.planName}`,
    html: shell({
      title: "New subscriber",
      body: `
        ${h1("🎉 You have a new subscriber!")}
        ${p(`<strong>${opts.fanName}</strong> just subscribed to your <strong>${opts.planName}</strong> plan for ${amount(opts.amountKobo)}/month.`)}
        ${p("Keep publishing great content to keep them subscribed.")}
      `,
      cta: { label: "View your dashboard", url: `${APP_URL}/creator/dashboard` },
    }),
  };
}

export function newTipEmail(opts: {
  creatorName: string;
  fanName: string;
  amountKobo: number;
}): { subject: string; html: string } {
  return {
    subject: `${opts.fanName} sent you a ${amount(opts.amountKobo)} tip`,
    html: shell({
      title: "New tip received",
      body: `
        ${h1(`💚 ${opts.fanName} sent you a tip!`)}
        ${p(`You received a <strong>${amount(opts.amountKobo)}</strong> tip from <strong>${opts.fanName}</strong>. The amount has been credited to your wallet.`)}
      `,
      cta: { label: "View earnings", url: `${APP_URL}/creator/earnings` },
    }),
  };
}

export function newMessageEmail(opts: {
  recipientName: string;
  senderName: string;
  preview: string;
}): { subject: string; html: string } {
  const safePreview = opts.preview.length > 120
    ? opts.preview.slice(0, 117) + "…"
    : opts.preview;

  return {
    subject: `New message from ${opts.senderName}`,
    html: shell({
      title: "New message",
      body: `
        ${h1(`💬 ${opts.senderName} sent you a message`)}
        ${p(`<em style="color:#555555;">"${safePreview}"</em>`)}
      `,
      cta: { label: "Reply now", url: `${APP_URL}/messages` },
    }),
  };
}

export function newCommentEmail(opts: {
  creatorName: string;
  authorName: string;
  commentBody: string;
}): { subject: string; html: string } {
  const preview = opts.commentBody.length > 120
    ? opts.commentBody.slice(0, 117) + "…"
    : opts.commentBody;

  return {
    subject: `${opts.authorName} commented on your post`,
    html: shell({
      title: "New comment",
      body: `
        ${h1("New comment on your post")}
        ${p(`<strong>${opts.authorName}</strong> left a comment:`)}
        ${p(`<em style="color:#555555;">"${preview}"</em>`)}
      `,
      cta: { label: "View post", url: `${APP_URL}/feed` },
    }),
  };
}

export function payoutEmail(opts: {
  creatorName: string;
  amountKobo: number;
  status: "requested" | "approved" | "rejected";
  failureReason?: string;
}): { subject: string; html: string } {
  const statusMap = {
    requested: {
      icon: "⏳",
      headline: `Your withdrawal of ${amount(opts.amountKobo)} is being processed`,
      body: "We have received your payout request. It will be reviewed and processed within 1–3 business days.",
    },
    approved: {
      icon: "✅",
      headline: `Your withdrawal of ${amount(opts.amountKobo)} has been approved`,
      body: "Your payout has been approved and is on its way to your bank account.",
    },
    rejected: {
      icon: "❌",
      headline: `Your withdrawal of ${amount(opts.amountKobo)} was not approved`,
      body: opts.failureReason
        ? `Reason: ${opts.failureReason}. Please contact support if you have questions.`
        : "Please contact support at support@fanbaseng.com for more information.",
    },
  };

  const { icon, headline, body } = statusMap[opts.status];

  return {
    subject: `${icon} Payout ${opts.status}: ${amount(opts.amountKobo)}`,
    html: shell({
      title: "Payout update",
      body: `
        ${h1(`${icon} ${headline}`)}
        ${p(body)}
      `,
      cta: { label: "View withdrawals", url: `${APP_URL}/creator/withdrawals` },
    }),
  };
}

export function paymentDisputeEmail(opts: {
  status: "opened" | "won" | "lost" | "closed";
  amountKobo: number;
}): { subject: string; html: string } {
  const statusMap = {
    opened: {
      icon: "⚠️",
      headline: `A payment of ${amount(opts.amountKobo)} has been disputed`,
      body: "A fan has disputed a charge with their bank. We've placed a hold on the related earnings in your wallet while the dispute is investigated — they will not be available for withdrawal until it's resolved. No action is needed from you right now.",
    },
    won: {
      icon: "✅",
      headline: `Dispute resolved in your favor — ${amount(opts.amountKobo)} released`,
      body: "The payment dispute was resolved in your favor. The held funds have been released back to your wallet balance.",
    },
    lost: {
      icon: "❌",
      headline: `Dispute resolved against you — ${amount(opts.amountKobo)} deducted`,
      body: "The payment dispute was resolved against you and the held funds have been permanently deducted from your wallet. The related subscriber's access has been revoked.",
    },
    closed: {
      icon: "ℹ️",
      headline: `Dispute closed — ${amount(opts.amountKobo)} released`,
      body: "The payment dispute was closed without a chargeback. The held funds have been released back to your wallet balance.",
    },
  };

  const { icon, headline, body } = statusMap[opts.status];

  return {
    subject: `${icon} Payment dispute ${opts.status}: ${amount(opts.amountKobo)}`,
    html: shell({
      title: "Payment dispute update",
      body: `
        ${h1(`${icon} ${headline}`)}
        ${p(body)}
      `,
      cta: { label: "View earnings", url: `${APP_URL}/creator/analytics` },
    }),
  };
}

export function accountStatusEmail(opts: {
  status: "suspended" | "banned" | "active";
}): { subject: string; html: string } {
  const map = {
    suspended: {
      icon: "⚠️",
      subject: "Your account has been suspended",
      headline: "Your account has been suspended",
      body: "Your Fanbase NG account has been temporarily suspended for violating our community guidelines or terms of service. While suspended, you won't be able to access the platform.",
      cta: { label: "Submit an appeal", url: `${APP_URL}/appeal` },
    },
    banned: {
      icon: "⛔",
      subject: "Your account has been banned",
      headline: "Your account has been banned",
      body: "Your Fanbase NG account has been permanently banned for violating our community guidelines or terms of service. If you believe this is a mistake, you can submit an appeal for review.",
      cta: { label: "Submit an appeal", url: `${APP_URL}/appeal` },
    },
    active: {
      icon: "✅",
      subject: "Your account has been reinstated",
      headline: "Your account has been reinstated",
      body: "Good news — your Fanbase NG account is active again and you can resume using the platform as normal.",
      cta: { label: "Go to Fanbase NG", url: `${APP_URL}/feed` },
    },
  };

  const { icon, subject, headline, body, cta } = map[opts.status];

  return {
    subject: `${icon} ${subject}`,
    html: shell({
      title: "Account status update",
      body: `
        ${h1(`${icon} ${headline}`)}
        ${p(body)}
      `,
      cta,
    }),
  };
}

export function appealResolvedEmail(opts: {
  outcome: "approved" | "denied";
  notes?: string | null;
}): { subject: string; html: string } {
  const map = {
    approved: {
      icon: "✅",
      subject: "Your appeal was approved — account reinstated",
      headline: "Your appeal was approved",
      body: "We've reviewed your appeal and reinstated your account. You can now sign in and use Fanbase NG as normal.",
      cta: { label: "Go to Fanbase NG", url: `${APP_URL}/feed` },
    },
    denied: {
      icon: "❌",
      subject: "Your appeal was denied",
      headline: "Your appeal was denied",
      body: "We've reviewed your appeal and decided to uphold the original decision on your account. ",
      cta: { label: "View details", url: `${APP_URL}/appeal` },
    },
  };

  const { icon, subject, headline, body, cta } = map[opts.outcome];
  const notes = opts.notes?.trim()
    ? p(`<strong>Reviewer notes:</strong> ${opts.notes.trim()}`)
    : "";

  return {
    subject: `${icon} ${subject}`,
    html: shell({
      title: "Appeal update",
      body: `
        ${h1(`${icon} ${headline}`)}
        ${p(body)}
        ${notes}
      `,
      cta,
    }),
  };
}

export function subscriptionPaymentFailedEmail(opts: {
  creatorName: string;
  planName: string;
  graceEndsAt: Date;
}): { subject: string; html: string } {
  const deadline = opts.graceEndsAt.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    subject: `⚠️ We couldn't renew your subscription to ${opts.creatorName}`,
    html: shell({
      title: "Renewal payment failed",
      body: `
        ${h1(`⚠️ Payment failed for ${opts.creatorName}`)}
        ${p(`We tried to renew your <strong>${opts.planName}</strong> subscription to ${opts.creatorName} but the charge to your card didn't go through.`)}
        ${p(`Your access continues for now, but you'll lose it on <strong>${deadline}</strong> unless we're able to successfully charge your card before then. Update your payment method to keep your subscription active.`)}
      `,
      cta: { label: "Update payment method", url: `${APP_URL}/subscriptions` },
    }),
  };
}

export function subscriptionEndedEmail(opts: {
  creatorName: string;
  planName: string;
}): { subject: string; html: string } {
  return {
    subject: `Your subscription to ${opts.creatorName} has ended`,
    html: shell({
      title: "Subscription ended",
      body: `
        ${h1(`Your subscription to ${opts.creatorName} has ended`)}
        ${p(`We weren't able to renew your <strong>${opts.planName}</strong> subscription after several attempts to charge your card, so it has now ended and your access has been removed.`)}
        ${p("If this was a mistake, you can resubscribe at any time with a working payment method.")}
      `,
      cta: { label: "Resubscribe", url: `${APP_URL}/subscriptions` },
    }),
  };
}

export function winBackEmail(opts: {
  creatorName: string;
  creatorUsername: string;
  planName: string;
}): { subject: string; html: string } {
  return {
    subject: `We miss you — come back to ${opts.creatorName}`,
    html: shell({
      title: "We miss you",
      body: `
        ${h1(`👋 ${opts.creatorName} would love to have you back`)}
        ${p(`Your <strong>${opts.planName}</strong> subscription to ${opts.creatorName} ended a little while ago. Resubscribe any time to pick up right where you left off.`)}
      `,
      cta: {
        label: `Visit ${opts.creatorName}`,
        url: `${APP_URL}/creators/${opts.creatorUsername}`,
      },
    }),
  };
}

export function newPostEmail(opts: {
  fanName: string;
  creatorName: string;
  creatorUsername: string;
  postCaption: string;
}): { subject: string; html: string } {
  const preview = opts.postCaption.trim().slice(0, 120) || "New post";
  return {
    subject: `New post from ${opts.creatorName}`,
    html: shell({
      title: `${opts.creatorName} posted`,
      body: `
        ${h1(`${opts.creatorName} just posted`)}
        ${p(`<em>${preview}</em>`)}
        ${p("Check it out on Fanbase.")}
      `,
      cta: {
        label: "View post",
        url: `${APP_URL}/creators/${opts.creatorUsername}`,
      },
    }),
  };
}

export function creatorLiveEmail(opts: {
  fanName: string;
  creatorName: string;
  creatorUsername: string;
  streamTitle: string;
}): { subject: string; html: string } {
  return {
    subject: `🔴 ${opts.creatorName} is live now`,
    html: shell({
      title: `${opts.creatorName} is live`,
      body: `
        ${h1(`🔴 ${opts.creatorName} is live!`)}
        ${p(`<strong>${opts.streamTitle}</strong>`)}
        ${p("Tune in now before the stream ends.")}
      `,
      cta: {
        label: "Watch live",
        url: `${APP_URL}/creators/${opts.creatorUsername}`,
      },
    }),
  };
}

export function weeklyDigestEmail(opts: {
  displayName: string;
  fanSection?: {
    newPostsCount: number;
    highlights: { creatorName: string; creatorUsername: string; caption: string }[];
    unreadNotifications: number;
  };
  creatorSection?: {
    grossKobo: number;
    newSubscribers: number;
    activeSubscribers: number;
  };
}): { subject: string; html: string } {
  const sections: string[] = [];

  if (opts.fanSection && opts.fanSection.newPostsCount > 0) {
    const highlightItems = opts.fanSection.highlights
      .map((h) => {
        const preview = h.caption.trim().slice(0, 100) || "New post";
        return `<li style="margin:0 0 8px;font-size:14px;color:#333333;line-height:1.5;">
          <a href="${APP_URL}/creators/${h.creatorUsername}" style="color:#0a0a0a;font-weight:600;text-decoration:none;">${h.creatorName}</a>
          — <em>${preview}</em>
        </li>`;
      })
      .join("");

    sections.push(`
      ${h1("📬 What you missed this week")}
      ${p(`<strong>${opts.fanSection.newPostsCount}</strong> new ${opts.fanSection.newPostsCount === 1 ? "post" : "posts"} from creators you're subscribed to:`)}
      <ul style="margin:0 0 16px;padding-left:20px;">${highlightItems}</ul>
      ${
        opts.fanSection.unreadNotifications > 0
          ? p(`You also have <strong>${opts.fanSection.unreadNotifications}</strong> unread ${opts.fanSection.unreadNotifications === 1 ? "notification" : "notifications"} waiting for you.`)
          : ""
      }
    `);
  }

  if (opts.creatorSection) {
    sections.push(`
      ${h1("📊 Your week as a creator")}
      ${p(`You earned <strong>${amount(opts.creatorSection.grossKobo)}</strong> and gained <strong>${opts.creatorSection.newSubscribers}</strong> new ${opts.creatorSection.newSubscribers === 1 ? "subscriber" : "subscribers"}, bringing your active subscriber count to <strong>${opts.creatorSection.activeSubscribers}</strong>.`)}
    `);
  }

  return {
    subject: "Your week on Fanbase NG",
    html: shell({
      title: "Your weekly digest",
      body: `
        ${h1(`Hey ${opts.displayName} 👋`)}
        ${p("Here's your weekly recap from Fanbase NG.")}
        ${sections.join('<div style="height:8px;"></div>')}
      `,
      cta: { label: "Open Fanbase NG", url: `${APP_URL}/feed` },
    }),
  };
}

export function accountDeletionEmail(opts: {
  stage: "scheduled" | "cancelled" | "completed";
  scheduledFor?: Date;
}): { subject: string; html: string } {
  const deadline = opts.scheduledFor
    ? opts.scheduledFor.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const map = {
    scheduled: {
      icon: "🗑️",
      subject: "Your account deletion request has been received",
      headline: "We're sorry to see you go",
      body: `We've scheduled your Fanbase NG account for permanent deletion on <strong>${deadline}</strong>. Until then, your account stays active and you can cancel the request at any time from Settings.`,
      cta: { label: "Cancel deletion", url: SETTINGS_URL },
    },
    cancelled: {
      icon: "✅",
      subject: "Your account deletion request was cancelled",
      headline: "Your account is safe",
      body: "You cancelled your scheduled account deletion — your account and data remain exactly as they were. Welcome back!",
      cta: { label: "Go to Fanbase NG", url: `${APP_URL}/feed` },
    },
    completed: {
      icon: "👋",
      subject: "Your Fanbase NG account has been deleted",
      headline: "Your account has been deleted",
      body: "As requested, your Fanbase NG account and personal information have been permanently removed. Active subscriptions tied to your account have been cancelled. Thanks for having been part of the community.",
      cta: undefined,
    },
  };

  const { icon, subject, headline, body, cta } = map[opts.stage];

  return {
    subject: `${icon} ${subject}`,
    html: shell({
      title: "Account deletion update",
      body: `
        ${h1(`${icon} ${headline}`)}
        ${p(body)}
      `,
      cta,
    }),
  };
}

export function giftSubscriptionEmail(opts: {
  gifterName: string;
  creatorName: string;
  planName: string;
  months: number;
}): { subject: string; html: string } {
  const monthsLabel = opts.months === 1 ? "1 month" : `${opts.months} months`;

  return {
    subject: `🎁 ${opts.gifterName} gifted you ${monthsLabel} of ${opts.creatorName}`,
    html: shell({
      title: "You received a gift subscription",
      body: `
        ${h1("🎁 You've got a gift!")}
        ${p(`<strong>${opts.gifterName}</strong> just gifted you <strong>${monthsLabel}</strong> of <strong>${opts.creatorName}</strong>'s <strong>${opts.planName}</strong> plan — already active on your account, no payment needed.`)}
        ${p("Head over to your subscriptions to see what you've unlocked.")}
      `,
      cta: { label: "View your subscriptions", url: `${APP_URL}/subscriptions` },
    }),
  };
}

export function kycDecisionEmail(opts: {
  outcome: "approved" | "rejected";
  rejectionReason?: string | null;
}): { subject: string; html: string } {
  if (opts.outcome === "approved") {
    return {
      subject: "Your creator verification has been approved",
      html: shell({
        title: "Verification approved",
        body: `
          ${h1("✅ You're verified!")}
          ${p("Your creator account has been reviewed and approved. A verified badge is now shown on your public profile.")}
          ${p("You can now request payouts without restriction. Keep creating great content!")}
        `,
        cta: { label: "Go to your profile", url: `${APP_URL}/creator/profile` },
      }),
    };
  }

  return {
    subject: "Your verification request was not approved",
    html: shell({
      title: "Verification not approved",
      body: `
        ${h1("Verification update")}
        ${p("Unfortunately, your verification request was not approved at this time.")}
        ${opts.rejectionReason ? p(`<strong>Reason:</strong> ${opts.rejectionReason}`) : ""}
        ${p("You can update your submission and reapply from your creator profile.")}
      `,
      cta: { label: "Reapply", url: `${APP_URL}/creator/profile` },
    }),
  };
}

export function copyrightClaimReceivedEmail(opts: {
  creatorName: string;
  postTitle: string;
  claimId: string;
  deadlineDate: string;
}): { subject: string; html: string } {
  return {
    subject: "Copyright claim filed against one of your posts",
    html: shell({
      title: "Copyright claim received",
      body: `
        ${h1("A copyright claim has been filed")}
        ${p(`Hi <strong>${opts.creatorName}</strong>,`)}
        ${p(`A copyright infringement claim has been submitted for your post <strong>"${opts.postTitle}"</strong>.`)}
        ${p(`You have until <strong>${opts.deadlineDate}</strong> to submit a counter-notice if you believe this claim is incorrect. If no counter-notice is received by this date, the post will be removed automatically.`)}
        ${p('To submit a counter-notice, please go to your post settings and select "Dispute this claim." By submitting a counter-notice you confirm that you have the rights to publish this content.')}
        ${p(`Claim reference: <code style="font-family:monospace;background:#f5f5f5;padding:2px 6px;border-radius:4px;">${opts.claimId}</code>`)}
      `,
      cta: { label: "View post settings", url: `${APP_URL}/creator/content` },
    }),
  };
}

export function copyrightAutoRemovedEmail(opts: {
  creatorName: string;
  postTitle: string;
}): { subject: string; html: string } {
  return {
    subject: "Your post has been removed following a copyright claim",
    html: shell({
      title: "Post removed",
      body: `
        ${h1("Post removed: copyright claim")}
        ${p(`Hi <strong>${opts.creatorName}</strong>,`)}
        ${p(`Your post <strong>"${opts.postTitle}"</strong> has been removed because a copyright claim was filed and the counter-notice window has elapsed without a response.`)}
        ${p("If you believe this was a mistake, please contact our support team with the claim reference number from the earlier notification.")}
      `,
      cta: { label: "Contact support", url: `${APP_URL}/help` },
    }),
  };
}

export function copyrightCounterNoticeAcknowledgedEmail(opts: {
  claimantEmail: string;
  postTitle: string;
  counterBody: string;
}): { subject: string; html: string } {
  return {
    subject: "Counter-notice received for your copyright claim",
    html: shell({
      title: "Counter-notice received",
      body: `
        ${h1("Counter-notice received")}
        ${p(`A counter-notice has been submitted for the copyright claim you filed regarding <strong>"${opts.postTitle}"</strong>.`)}
        ${p("Our team will review both the original claim and the counter-notice and reach a decision within 10 business days.")}
        ${p(`Counter-notice statement: <em>"${opts.counterBody.slice(0, 500)}${opts.counterBody.length > 500 ? "…" : ""}"</em>`)}
      `,
      cta: { label: "Visit Fanbase NG", url: APP_URL },
    }),
  };
}

export function missedCallEmail(opts: {
  callerName: string;
  callType: "voice" | "video";
}): { subject: string; html: string } {
  const kind = opts.callType === "video" ? "video call" : "voice call";

  return {
    subject: `Missed ${kind} from ${opts.callerName}`,
    html: shell({
      title: `You missed a ${kind}`,
      body: `
        ${h1(`📞 Missed ${kind}`)}
        ${p(`<strong>${opts.callerName}</strong> tried to reach you with a ${kind} on Fanbase NG.`)}
        ${p("Reply in the conversation to let them know when you're free, or call them back.")}
      `,
      cta: { label: "Open conversation", url: `${APP_URL}/messages` },
    }),
  };
}
