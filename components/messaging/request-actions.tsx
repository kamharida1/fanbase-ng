"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { respondToMessageRequest } from "@/lib/messaging/actions";
import { Button } from "@/components/ui/button";

export function RequestActions({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "accept" | "decline") {
    setError(null);
    setLoading(action);
    const result = await respondToMessageRequest({ conversationId, action });
    setLoading(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
      <span className="text-sm font-medium">Message request</span>
      <Button
        type="button"
        size="sm"
        disabled={loading !== null}
        onClick={() => void handle("accept")}
      >
        {loading === "accept" ? "…" : "Accept"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading !== null}
        onClick={() => void handle("decline")}
      >
        {loading === "decline" ? "…" : "Decline"}
      </Button>
      {error ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
