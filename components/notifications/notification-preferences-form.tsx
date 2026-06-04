"use client";

import { useState } from "react";

import { updateNotificationPreferencesAction } from "@/lib/notifications/actions";
import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES } from "@/lib/notifications/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { NotificationPreferences } from "@/types/notifications";

export function NotificationPreferencesForm({
  initial,
}: {
  initial: NotificationPreferences;
}) {
  const [prefs, setPrefs] = useState(initial.preferences);
  const [emailEnabled, setEmailEnabled] = useState(initial.email_enabled);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await updateNotificationPreferencesAction({
      emailEnabled,
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
      <div className="space-y-3">
        <h3 className="font-semibold">In-app notifications</h3>
        {NOTIFICATION_TYPES.map((type) => (
          <label
            key={type}
            className="flex cursor-pointer items-center justify-between gap-4 text-sm"
          >
            <span>{NOTIFICATION_TYPE_LABELS[type]}</span>
            <input
              type="checkbox"
              checked={prefs[type]}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, [type]: e.target.checked }))
              }
              className="h-4 w-4"
            />
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 text-sm">
        <Label htmlFor="email-enabled">Email notifications (future)</Label>
        <input
          id="email-enabled"
          type="checkbox"
          checked={emailEnabled}
          onChange={(e) => setEmailEnabled(e.target.checked)}
          className="h-4 w-4"
        />
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
