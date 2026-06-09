"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function ContentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("creator_content.page_error", { err: error, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8 text-center">
      <h2 className="text-lg font-semibold">Could not load your content</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Please try again in a moment.
      </p>
      <Button type="button" className="mt-6" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
