import { redirect } from "next/navigation";

import { BroadcastComposer } from "@/components/broadcast/broadcast-composer";
import { BroadcastHistory } from "@/components/broadcast/broadcast-history";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { listBroadcasts } from "@/lib/broadcast/actions";
import { createClient } from "@/lib/supabase/server";

export default async function CreatorBroadcastPage() {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") redirect("/settings");

  const broadcasts = await listBroadcasts(20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Mass message</h1>
        <p className="mt-2 text-muted-foreground">
          Send a message to your subscribers at once — free or pay-to-unlock.
          Target everyone, a specific tier, or a subscriber segment like new
          joiners or fans about to lapse.
        </p>
      </div>

      <BroadcastComposer creatorId={auth.userId} />

      <section className="rounded-xl border p-5">
        <h2 className="font-semibold">How it works</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Free message</span>{" "}
            — appears in every subscriber&apos;s inbox immediately. Great for
            announcements, shoutouts, and behind-the-scenes updates.
          </li>
          <li>
            <span className="font-medium text-foreground">Pay-to-unlock</span>{" "}
            — subscribers see a preview and pay your set price to read the
            full message. Their payment is credited to your wallet.
          </li>
          <li>
            <span className="font-medium text-foreground">Targeting</span>{" "}
            — narrow your audience by tier (e.g. only your top tier) and by
            segment (new subscribers, long-time subscribers, or fans set to
            cancel soon) to send the right message to the right people.
          </li>
          <li>
            <span className="font-medium text-foreground">500 recipient cap</span>{" "}
            — the first 500 matching subscribers receive each broadcast.
            Larger audience support is coming.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Broadcast history</h2>
        <BroadcastHistory broadcasts={broadcasts} />
      </section>
    </div>
  );
}
