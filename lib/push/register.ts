"use client";

import { deletePushSubscription, savePushSubscription } from "@/lib/push/actions";

export type PushSupport = "unsupported" | "denied" | "ready";

export function getPushSupport(): PushSupport {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

/** Registers the service worker, requests permission, and persists a push subscription. */
export async function enablePushNotifications(): Promise<{ success: boolean; error?: string }> {
  const support = getPushSupport();
  if (support === "unsupported") {
    return { success: false, error: "Push notifications are not supported on this browser." };
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return { success: false, error: "Push notifications are not configured." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { success: false, error: "Notification permission was not granted." };
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { success: false, error: "Could not create a push subscription." };
  }

  const result = await savePushSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    userAgent: navigator.userAgent,
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}

/** Unsubscribes from push on this device and removes the stored subscription. */
export async function disablePushNotifications(): Promise<{ success: boolean; error?: string }> {
  if (getPushSupport() === "unsupported") return { success: true };

  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return { success: true };

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const result = await deletePushSubscription(endpoint);
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}
