import { DisputesPanel } from "@/components/admin/disputes-panel";
import { listAdminDisputes } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminDisputesPage() {
  const admin = await createStaffAdminClient();
  const disputes = await listAdminDisputes(admin, { limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Disputes &amp; chargebacks</h1>
        <p className="mt-2 text-muted-foreground">
          Payment disputes opened by fans through their bank. Disputed earnings
          are automatically held in the creator&apos;s wallet until you resolve
          the case.
        </p>
      </div>
      <DisputesPanel disputes={disputes} />
    </div>
  );
}
