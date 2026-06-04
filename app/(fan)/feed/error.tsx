"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "feed_error_boundary",
        message: error.message,
        digest: error.digest,
      }),
    );
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-8 text-center">
      <h2 className="text-lg font-semibold">Could not load your feed</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || "Please try again in a moment."}
      </p>
      <Button type="button" className="mt-6" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
