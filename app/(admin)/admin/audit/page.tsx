import { AuditPanel } from "@/components/admin/audit-panel";
import { listAdminAuditLogs } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminAuditPage() {
  const admin = await createStaffAdminClient();
  const logs = await listAdminAuditLogs(admin, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit logs</h1>
        <p className="mt-2 text-muted-foreground">
          Immutable trail of payments, admin actions, and system events.
        </p>
      </div>
      <AuditPanel logs={logs} />
    </div>
  );
}
