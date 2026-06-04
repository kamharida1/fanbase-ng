import { AnalyticsPanel } from "@/components/admin/analytics-panel";
import { getAdminAnalytics } from "@/lib/admin/queries";
import { createStaffAdminClient } from "@/lib/admin/server";

export default async function AdminAnalyticsPage() {
  const admin = await createStaffAdminClient();
  const analytics = await getAdminAnalytics(admin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-2 text-muted-foreground">
          Signup trends, daily revenue, and top earning creators.
        </p>
      </div>
      <AnalyticsPanel {...analytics} />
    </div>
  );
}
