"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function StartConversationForm() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MessageCircle className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">No messages yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Visit a creator&apos;s profile and tap <strong>Message</strong> to start a conversation.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/creators">Browse creators</Link>
      </Button>
    </div>
  );
}
