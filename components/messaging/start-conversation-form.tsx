"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { startConversationWithCreator } from "@/lib/messaging/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StartConversationForm() {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await startConversationWithCreator({ creatorId });
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(`/messages?c=${result.data?.conversationId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 max-w-md space-y-3 rounded-lg border p-4"
    >
      <p className="text-sm font-medium">Message a creator</p>
      <p className="text-xs text-muted-foreground">
        Paste a creator user ID, or open a creator profile and use Message (coming
        on profile). You can also discover creators at{" "}
        <Link href="/creators" className="underline">
          /creators
        </Link>
        .
      </p>
      <div className="space-y-2">
        <Label htmlFor="creatorId">Creator ID</Label>
        <Input
          id="creatorId"
          value={creatorId}
          onChange={(e) => setCreatorId(e.target.value)}
          placeholder="UUID from creator profile"
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading}>
        {loading ? "Starting…" : "Start conversation"}
      </Button>
    </form>
  );
}
