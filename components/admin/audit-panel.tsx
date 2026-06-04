import { formatAdminDate } from "@/lib/admin/format";
import type { AdminAuditRow } from "@/types/admin";

export function AuditPanel({ logs }: { logs: AdminAuditRow[] }) {
  if (logs.length === 0) {
    return <p className="text-muted-foreground">No audit logs.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="p-3">Time</th>
            <th className="p-3">Action</th>
            <th className="p-3">Entity</th>
            <th className="p-3">Actor</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={`${log.id}-${log.created_at}`} className="border-b last:border-0">
              <td className="p-3 whitespace-nowrap">
                {formatAdminDate(log.created_at)}
              </td>
              <td className="p-3 font-mono text-xs">{log.action}</td>
              <td className="p-3">
                {log.entity_type}
                {log.entity_id ? (
                  <span className="block text-xs text-muted-foreground">
                    {log.entity_id.slice(0, 8)}…
                  </span>
                ) : null}
              </td>
              <td className="p-3">{log.actor_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
