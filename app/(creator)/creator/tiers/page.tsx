import { PlansManager, type PlanRow } from "@/components/creator/plans-manager";
import { getCreatorStudioProfile } from "@/lib/creators/queries";
import { requireRole } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export default async function CreatorTiersPage() {
  const supabase = await createClient();
  const auth = await requireRole(supabase, "creator");
  const studio = await getCreatorStudioProfile(supabase, auth.userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription plans</h1>
        <p className="mt-2 text-muted-foreground">
          Set monthly tiers shown on your public profile. Paystack sync comes in
          the next increment.
        </p>
      </div>
      <PlansManager plans={(studio.plans ?? []) as PlanRow[]} />
    </div>
  );
}
