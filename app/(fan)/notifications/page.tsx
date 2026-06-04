import { NotificationList } from "@/components/notifications/notification-list";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import {
  getNotificationPreferences,
  listNotifications,
} from "@/lib/notifications/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/notifications");

  const [{ notifications, nextCursor }, preferences] = await Promise.all([
    listNotifications(supabase, { userId: auth.userId }),
    getNotificationPreferences(supabase, auth.userId),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-2 text-muted-foreground">
          Subscribers, messages, comments, likes, and payouts — updated in real
          time.
        </p>
      </div>

      <NotificationList
        userId={auth.userId}
        initialNotifications={notifications}
        initialCursor={nextCursor}
      />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <NotificationPreferencesForm initial={preferences} />
      </section>
    </div>
  );
}
