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
