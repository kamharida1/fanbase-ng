import { Suspense } from "react";

import { MessagingInbox } from "@/components/messaging/messaging-inbox";
import { StartConversationForm } from "@/components/messaging/start-conversation-form";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { isStaffRole } from "@/lib/auth/rbac";
import { buildWatermarkLabel } from "@/lib/media/watermark";
import {
  getConversation,
  listConversations,
  listMessages,
} from "@/lib/messaging/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ c?: string; tab?: string }>;
};

export default async function FanMessagesPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/messages");

  const watermarkLabel = buildWatermarkLabel({
    username: auth.profile.username,
    userId: auth.userId,
  });

  const params = await searchParams;
  const inbox = await listConversations(supabase, auth.userId, "fan", "inbox");

  let selectedConversation = null;
  let messages: Awaited<ReturnType<typeof listMessages>> = [];

  if (params.c) {
    selectedConversation = await getConversation(
      supabase,
      params.c,
      auth.userId,
    );
    if (selectedConversation) {
      const otherId = selectedConversation.creator_id;
      messages = await listMessages(supabase, {
        conversationId: params.c,
        userId: auth.userId,
        otherUserId: otherId,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="mt-2 text-muted-foreground">
          Direct messages with creators. New chats start as message requests.
        </p>
      </div>

      {inbox.length === 0 && !params.c ? (
        <StartConversationForm />
      ) : null}

      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <MessagingInbox
          initialInbox={inbox}
          initialRequests={[]}
          initialMessages={messages}
          selectedConversation={selectedConversation}
          currentUserId={auth.userId}
          role="fan"
          requestCount={0}
          watermarkLabel={watermarkLabel}
          callerUsername={auth.profile.username}
          callerDisplayName={auth.profile.display_name}
          hideRequestLimits={isStaffRole(auth.appRole)}
        />
      </Suspense>
    </div>
  );
}
