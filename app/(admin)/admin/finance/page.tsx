import { FinancePanel } from "@/components/admin/finance-panel";
import { getAdminFinanceSummary } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminFinancePage() {
  const admin = await createStaffAdminClient();
  const summary = await getAdminFinanceSummary(admin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financial reports</h1>
        <p className="mt-2 text-muted-foreground">
          Payments, payouts, and creator earnings over the last 30 days.
        </p>
      </div>
      <FinancePanel summary={summary} />
    </div>
  );
}
