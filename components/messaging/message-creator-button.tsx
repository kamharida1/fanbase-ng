"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { startConversationWithCreator } from "@/lib/messaging/actions";
import { Button } from "@/components/ui/button";

export function MessageCreatorButton({
  creatorId,
  isLoggedIn,
  loginNext,
}: {
  creatorId: string;
  isLoggedIn: boolean;
  loginNext: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!isLoggedIn) {
    return (
      <Button variant="outline" asChild>
        <a href={`/login?next=${encodeURIComponent(loginNext)}`}>Message</a>
      </Button>
    );
  }

  async function handleClick() {
    setLoading(true);
    const result = await startConversationWithCreator({ creatorId });
    setLoading(false);
    if (result.success && result.data) {
      router.push(`/messages?c=${result.data.conversationId}`);
    }
  }

  return (
    <Button variant="outline" disabled={loading} onClick={() => void handleClick()}>
      {loading ? "Opening…" : "Message"}
    </Button>
  );
}
