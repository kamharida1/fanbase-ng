import { ModerationPanel } from "@/components/admin/moderation-panel";
import { listModerationQueue } from "@/lib/moderation";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminModerationPage() {
  const admin = await createStaffAdminClient();
  const items = await listModerationQueue(admin, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content review</h1>
        <p className="mt-2 text-muted-foreground">
          Approve, reject, or remove posts in the moderation queue. New
          publishes enter the queue automatically.
        </p>
      </div>
      <ModerationPanel items={items} />
    </div>
  );
}
