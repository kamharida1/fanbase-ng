import { ROLE_LABELS } from "@/lib/auth/rbac";
import type { AppRole } from "@/types/auth";

export function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium">
      {ROLE_LABELS[role]}
    </span>
  );
}
