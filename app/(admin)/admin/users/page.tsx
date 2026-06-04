import { UsersManager } from "@/components/admin/users-manager";
import { listAdminUsers } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { q = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const admin = await createStaffAdminClient();
  const { users, total } = await listAdminUsers(admin, {
    q,
    page,
    limit: 25,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User management</h1>
        <p className="mt-2 text-muted-foreground">
          Search accounts, suspend, or ban users.
        </p>
      </div>
      <UsersManager users={users} total={total} page={page} q={q} />
    </div>
  );
}
