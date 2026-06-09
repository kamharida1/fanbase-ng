"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function CreatorMessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("creator_messages.page_error", { err: error, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8 text-center">
      <h2 className="text-lg font-semibold">Could not load messages</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Please check your connection and try again.
      </p>
      <Button type="button" className="mt-6" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
