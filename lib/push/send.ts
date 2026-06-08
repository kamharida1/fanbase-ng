import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

import type { NotificationType } from "@/types/notifications";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fanbaseng.com";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:support@fanbaseng.com";
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

type SendInput = {
  userId: string;
  notificationType: NotificationType;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
};

/**
 * Sends a web push notification to every subscribed device for a user.
 * Silently skips if:
 * - VAPID keys are not configured
 * - The user has disabled push notifications globally
 * - The user has disabled this specific notification type
 * - The user has no push subscriptions on file
 * Expired/invalid subscriptions (404/410 from the push service) are removed.
 */
export async function sendPushNotification(
  admin: SupabaseClient,
  input: SendInput,
): Promise<void> {
  if (!ensureConfigured()) return;

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("push_enabled, preferences")
    .eq("user_id", input.userId)
    .maybeSingle();

  const pushEnabled = prefs?.push_enabled ?? true;
  if (!pushEnabled) return;

  const typePrefs = (prefs?.preferences ?? {}) as Record<string, unknown>;
  const typeEnabled = typePrefs[input.notificationType] ?? true;
  if (!typeEnabled) return;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", input.userId);

  if (!subs?.length) return;

  const payload = JSON.stringify({
    title: input.title,
    body: input.body ?? "",
    url: input.actionUrl ?? APP_URL,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          payload,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("[push] send", input.userId, statusCode, err);
        }
      }
    }),
  );
}
