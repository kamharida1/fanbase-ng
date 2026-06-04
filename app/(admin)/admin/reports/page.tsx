import { ReportsPanel } from "@/components/admin/reports-panel";
import { listAdminReports } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminReportsPage() {
  const admin = await createStaffAdminClient();
  const reports = await listAdminReports(admin, { limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-2 text-muted-foreground">
          Review user-submitted reports and resolve or dismiss them.
        </p>
      </div>
      <ReportsPanel reports={reports} />
    </div>
  );
}
