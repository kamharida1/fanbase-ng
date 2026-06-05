import type { SupabaseClient } from "@supabase/supabase-js";

import { getFromAddress, getResendClient, REPLY_TO } from "@/lib/email/client";
import type { NotificationType } from "@/types/notifications";

type SendInput = {
  userId: string;
  notificationType: NotificationType;
  subject: string;
  html: string;
};

/**
 * Sends an email notification to a user.
 * Silently skips if:
 * - RESEND_API_KEY is not configured
 * - The user has disabled email notifications globally
 * - The user has disabled this specific notification type
 * - The user has no email address on file
 */
export async function sendEmailNotification(
  admin: SupabaseClient,
  input: SendInput,
): Promise<void> {
  const resend = getResendClient();
  if (!resend) return; // Resend not configured — skip silently

  // Get user email and preferences in parallel
  const [{ data: authUser }, { data: prefs }] = await Promise.all([
    admin.auth.admin.getUserById(input.userId),
    admin
      .from("notification_preferences")
      .select("email_enabled, preferences")
      .eq("user_id", input.userId)
      .maybeSingle(),
  ]);

  const email = authUser?.user?.email;
  if (!email) return;

  // Respect global and per-type email opt-out
  const emailEnabled = prefs?.email_enabled ?? true;
  if (!emailEnabled) return;

  const typePrefs = (prefs?.preferences ?? {}) as Record<string, unknown>;
  const typeEnabled = typePrefs[input.notificationType] ?? true;
  if (!typeEnabled) return;

  await resend.emails.send({
    from: getFromAddress(),
    to: email,
    replyTo: REPLY_TO,
    subject: input.subject,
    html: input.html,
  });
}

/**
 * Sends to a plain email address without preference checks.
 * Used for transactional emails (welcome, payout status) where the
 * recipient email is known directly.
 */
export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  await resend.emails.send({
    from: getFromAddress(),
    to: input.to,
    replyTo: REPLY_TO,
    subject: input.subject,
    html: input.html,
  });
}
