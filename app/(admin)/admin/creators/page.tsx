import { CreatorsManager } from "@/components/admin/creators-manager";
import { listAdminCreators } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function AdminCreatorsPage({ searchParams }: PageProps) {
  const { q = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const admin = await createStaffAdminClient();
  const { creators, total } = await listAdminCreators(admin, {
    q,
    page,
    limit: 25,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Creator management</h1>
        <p className="mt-2 text-muted-foreground">
          Verify creators, control subscriptions, and feed priority.
        </p>
      </div>
      <CreatorsManager creators={creators} total={total} page={page} q={q} />
    </div>
  );
}
