import { PayoutsPanel } from "@/components/admin/payouts-panel";
import { listAdminPayouts } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminPayoutsPage() {
  const admin = await createStaffAdminClient();
  const payouts = await listAdminPayouts(admin, {
    status: ["pending", "review", "processing", "completed", "failed", "cancelled"],
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payout approvals</h1>
        <p className="mt-2 text-muted-foreground">
          Approve or reject creator withdrawal requests. Rejected payouts return
          funds to the creator wallet.
        </p>
      </div>
      <PayoutsPanel payouts={payouts} />
    </div>
  );
}
