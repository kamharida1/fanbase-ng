"use client";

import { useState } from "react";

import { updateNotificationPreferencesAction } from "@/lib/notifications/actions";
import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES } from "@/lib/notifications/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { NotificationPreferences } from "@/types/notifications";

export function NotificationPreferencesForm({
  initial,
}: {
  initial: NotificationPreferences;
}) {
  const [prefs, setPrefs] = useState(initial.preferences);
  const [emailEnabled, setEmailEnabled] = useState(initial.email_enabled);
  const [pushEnabled, setPushEnabled] = useState(initial.push_enabled);
  const [smsEnabled, setSmsEnabled] = useState(initial.sms_enabled);
  const [marketingEnabled, setMarketingEnabled] = useState(initial.marketing_enabled);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await updateNotificationPreferencesAction({
      emailEnabled,
      pushEnabled,
      smsEnabled,
      marketingEnabled,
      ...prefs,
    });

    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setMessage("Preferences saved.");
  }

  return (
    <div className="max-w-md space-y-6 rounded-xl border p-5">
      {/* Per-type in-app toggles */}
      <div className="space-y-3">
        <h3 className="font-semibold">In-app notifications</h3>
        {NOTIFICATION_TYPES.map((type) => (
          <div key={type} className="flex items-center justify-between gap-4 text-sm">
            <Label htmlFor={`pref-${type}`}>{NOTIFICATION_TYPE_LABELS[type]}</Label>
            <Switch
              id={`pref-${type}`}
              checked={!!prefs[type]}
              onCheckedChange={(on) =>
                setPrefs((p) => ({ ...p, [type]: on }))
              }
            />
          </div>
        ))}
      </div>

      {/* Channel toggles */}
      <div className="space-y-3">
        <h3 className="font-semibold">Notification channels</h3>
        <div className="flex items-center justify-between gap-4 text-sm">
          <Label htmlFor="email-enabled">Email notifications</Label>
          <Switch
            id="email-enabled"
            checked={emailEnabled}
            onCheckedChange={setEmailEnabled}
          />
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <Label htmlFor="push-enabled">Push notifications</Label>
          <Switch
            id="push-enabled"
            checked={pushEnabled}
            onCheckedChange={setPushEnabled}
          />
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <Label htmlFor="sms-enabled">SMS notifications</Label>
          <Switch
            id="sms-enabled"
            checked={smsEnabled}
            onCheckedChange={setSmsEnabled}
          />
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <Label htmlFor="marketing-enabled">Marketing & updates</Label>
          <Switch
            id="marketing-enabled"
            checked={marketingEnabled}
            onCheckedChange={setMarketingEnabled}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      <Button type="button" disabled={loading} onClick={() => void handleSave()}>
        Save preferences
      </Button>
    </div>
  );
}
