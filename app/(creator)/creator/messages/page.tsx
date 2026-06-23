import { Suspense } from "react";

import { MessagingInbox } from "@/components/messaging/messaging-inbox";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { isStaffRole } from "@/lib/auth/rbac";
import { buildWatermarkLabel } from "@/lib/media/watermark";
import {
  countPendingRequests,
  getConversation,
  listConversations,
  listMessages,
} from "@/lib/messaging/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ c?: string; tab?: string }>;
};

export default async function CreatorMessagesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/creator/messages");

  const watermarkLabel = buildWatermarkLabel({
    username: auth.profile.username,
    userId: auth.userId,
  });

  const params = await searchParams;
  const filter = params.tab === "requests" ? "requests" : "inbox";

  const [inbox, requests, requestCount] = await Promise.all([
    listConversations(supabase, auth.userId, "creator", "inbox"),
    listConversations(supabase, auth.userId, "creator", "requests"),
    countPendingRequests(supabase, auth.userId),
  ]);

  const listForSelection = filter === "requests" ? requests : inbox;

  let selectedConversation = null;
  let messages: Awaited<ReturnType<typeof listMessages>> = [];

  if (params.c) {
    selectedConversation = await getConversation(
      supabase,
      params.c,
      auth.userId,
    );
    if (selectedConversation) {
      const otherId = selectedConversation.fan_id;
      messages = await listMessages(supabase, {
        conversationId: params.c,
        userId: auth.userId,
        otherUserId: otherId,
      });
    }
  } else if (listForSelection[0] && filter === "inbox") {
    // Optional: auto-select first — skip to avoid redirect noise
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="mt-2 text-muted-foreground">
          Fan inbox, message requests, read receipts, and attachments.
        </p>
      </div>

      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <MessagingInbox
          initialInbox={inbox}
          initialRequests={requests}
          initialMessages={messages}
          selectedConversation={selectedConversation}
          currentUserId={auth.userId}
          role="creator"
          requestCount={requestCount}
          watermarkLabel={watermarkLabel}
          callerUsername={auth.profile.username}
          callerDisplayName={auth.profile.display_name}
          hideRequestLimits={isStaffRole(auth.appRole)}
        />
      </Suspense>
    </div>
  );
}
