import { GoLivePanel } from "@/components/live/go-live-panel";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { getCreatorLiveStream } from "@/lib/live/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CreatorLivePage() {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") redirect("/settings");

  const admin = createAdminClient();
  const stream = await getCreatorLiveStream(admin, auth.userId);

  const existing = stream
    ? {
        streamId: stream.id,
        status: stream.status as "idle" | "live",
        rtmpsUrl: stream.rtmps_url,
        streamKey: stream.stream_key,
        embedUrl: stream.embed_url,
        cloudflareUid: stream.cloudflare_uid,
      }
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Go live</h1>
        <p className="mt-2 text-muted-foreground">
          Stream directly to your subscribers using OBS or any RTMP app.
        </p>
      </div>
      <GoLivePanel existing={existing} />
    </div>
  );
}
