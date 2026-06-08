import { AppealsPanel } from "@/components/admin/appeals-panel";
import { listAdminAppeals } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminAppealsPage() {
  const admin = await createStaffAdminClient();
  const appeals = await listAdminAppeals(admin, { limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account appeals</h1>
        <p className="mt-2 text-muted-foreground">
          Suspended or banned users can request a review of their account
          status. Approving an appeal immediately reinstates the account.
        </p>
      </div>
      <AppealsPanel appeals={appeals} />
    </div>
  );
}
