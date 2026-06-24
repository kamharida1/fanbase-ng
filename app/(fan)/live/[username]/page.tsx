import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

import { LivePlayer } from "@/components/live/live-player";
import { LiveChatPanel } from "@/components/live/live-chat-panel";
import { TipButton } from "@/components/tips/tip-button";
import { listLiveChatMessages } from "@/lib/live/chat";
import { getPublicLiveStream } from "@/lib/live/queries";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getCreatorByUsername } from "@/lib/creators/queries";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ username: string }>;
};

export default async function WatchLivePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const auth = await getAuthContext(supabase);
  if (!auth) redirect(`/login?next=/live/${username}`);

  const creator = await getCreatorByUsername(supabase, username);
  if (!creator) notFound();

  const stream = await getPublicLiveStream(supabase, creator.user_id);
  if (!stream) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
        <h1 className="text-2xl font-bold">
          {creator.display_name ?? creator.username} isn&apos;t live right now
        </h1>
        <p className="text-muted-foreground">
          Check back later, or visit their profile to see recent posts.
        </p>
      </div>
    );
  }

  const messages = await listLiveChatMessages(supabase, stream.id);
  const creatorLabel = creator.display_name ?? creator.username;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {stream.embed_url ? (
          <LivePlayer
            embedUrl={stream.embed_url}
            title={stream.title}
            creatorName={creatorLabel}
          />
        ) : null}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold">{stream.title}</h1>
            <p className="text-sm text-muted-foreground">@{creator.username}</p>
          </div>
          <TipButton
            creatorId={creator.user_id}
            creatorUsername={creator.username}
            isLoggedIn={Boolean(auth)}
          />
        </div>
      </div>

      <div className="h-[480px] lg:h-[calc(100vh-8rem)]">
        <LiveChatPanel
          streamId={stream.id}
          initialMessages={messages}
          viewerId={auth.userId}
        />
      </div>
    </div>
  );
}
