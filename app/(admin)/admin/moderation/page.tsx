import { ModerationPanel } from "@/components/admin/moderation-panel";
import { StalePostsBacklog } from "@/components/admin/stale-posts-backlog";
import {
  countStalePendingPublishedPosts,
  listModerationQueue,
} from "@/lib/moderation";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminModerationPage() {
  const admin = await createStaffAdminClient();
  const [items, staleCount] = await Promise.all([
    listModerationQueue(admin, 50),
    countStalePendingPublishedPosts(admin),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content review</h1>
        <p className="mt-2 text-muted-foreground">
          Review flagged content and clear any older posts still stuck in pending
          moderation from before auto-approval.
        </p>
      </div>
      <StalePostsBacklog count={staleCount} />
      <ModerationPanel items={items} />
    </div>
  );
}
