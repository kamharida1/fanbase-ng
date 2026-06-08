"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cancelAccountDeletion, requestAccountDeletion } from "@/lib/account/actions";
import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/account/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(new Date(iso));
}

export function DeleteAccountSection({
  username,
  isCreator,
  scheduledFor,
}: {
  username: string;
  isCreator: boolean;
  scheduledFor: string | null;
}) {
  const router = useRouter();
  const [pendingScheduledFor, setPendingScheduledFor] = useState(scheduledFor);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const result = await requestAccountDeletion();
    setLoading(false);
    if (result.success) {
      setPendingScheduledFor(result.scheduledFor);
      setConfirming(false);
      setConfirmText("");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleCancel() {
    setLoading(true);
    setError(null);
    const result = await cancelAccountDeletion();
    setLoading(false);
    if (result.success) {
      setPendingScheduledFor(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  if (pendingScheduledFor) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p>
          Your account is scheduled for permanent deletion on{" "}
          <strong>{formatDate(pendingScheduledFor)}</strong>. Until then your account
          stays active and you can change your mind at any time.
        </p>
        <Button type="button" size="sm" disabled={loading} onClick={() => void handleCancel()}>
          {loading ? "Cancelling…" : "Cancel deletion"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Permanently delete your account, profile, and personal information.{" "}
          {isCreator
            ? "Your active subscribers will lose access and their subscriptions will be cancelled."
            : "Your active subscriptions will be cancelled."}{" "}
          This can&apos;t be undone once it takes effect.
        </p>
        <Button type="button" variant="destructive" size="sm" onClick={() => setConfirming(true)}>
          Delete my account
        </Button>
      </div>
    );
  }

  const matches = confirmText.trim() === username;

  return (
    <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p>
        We&apos;ll schedule your account for deletion in{" "}
        <strong>{ACCOUNT_DELETION_GRACE_DAYS} days</strong>, during which you can cancel
        the request from this page. Once the deletion completes, your profile, posts,
        {isCreator ? " content, " : " "}
        and personal information are permanently removed and your subscriptions
        {isCreator ? " (and your subscribers') " : " "}
        are cancelled. This cannot be reversed afterwards.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-username">
          Type <span className="font-mono">{username}</span> to confirm
        </Label>
        <Input
          id="confirm-username"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={!matches || loading}
          onClick={() => void handleDelete()}
        >
          {loading ? "Scheduling…" : "Schedule deletion"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => { setConfirming(false); setConfirmText(""); setError(null); }}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
