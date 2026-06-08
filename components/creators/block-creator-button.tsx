"use client";

import { useState } from "react";

import { blockCreator, unblockCreator } from "@/lib/creators/block-actions";
import { Button } from "@/components/ui/button";

type Props = {
  creatorId: string;
  creatorUsername: string;
  initialBlocked: boolean;
};

export function BlockCreatorButton({ creatorId, creatorUsername, initialBlocked }: Props) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = blocked
      ? await unblockCreator(creatorId)
      : await blockCreator(creatorId);
    setLoading(false);
    if (result.success) {
      setBlocked(!blocked);
      setConfirming(false);
    } else {
      setError(result.error);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {blocked ? `Unblock @${creatorUsername}?` : `Block @${creatorUsername}?`}
        </span>
        <Button
          type="button"
          size="sm"
          variant={blocked ? "default" : "destructive"}
          disabled={loading}
          onClick={handleConfirm}
        >
          {loading ? "…" : "Confirm"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => { setConfirming(false); setError(null); }}
        >
          Cancel
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={blocked ? "" : "text-muted-foreground"}
      onClick={() => setConfirming(true)}
    >
      {blocked ? `Unblock @${creatorUsername}` : "Block"}
    </Button>
  );
}
