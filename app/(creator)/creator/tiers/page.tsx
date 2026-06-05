import { PlansManager, type PlanRow } from "@/components/creator/plans-manager";
import { OfferManager } from "@/components/subscriptions/offer-manager";
import { getCreatorStudioProfile } from "@/lib/creators/queries";
import { listCreatorOffers } from "@/lib/offers/queries";
import { requireRole } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export default async function CreatorTiersPage() {
  const supabase = await createClient();
  const auth = await requireRole(supabase, "creator");
  const [studio, offers] = await Promise.all([
    getCreatorStudioProfile(supabase, auth.userId),
    listCreatorOffers(supabase, auth.userId),
  ]);

  const plans = (studio.plans ?? []) as PlanRow[];
  const paidPlans = plans.filter((p) => p.billing_interval !== "free" && p.is_active);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Subscription plans</h1>
        <p className="mt-2 text-muted-foreground">
          Set monthly tiers shown on your public profile.
        </p>
      </div>

      <PlansManager plans={plans} />

      {paidPlans.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Limited-time offers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Discount your first month to attract new subscribers. Fans see
              the offer on your profile with a countdown timer.
            </p>
          </div>
          <OfferManager
            plans={paidPlans.map((p) => ({
              id: p.id,
              name: p.name,
              price_kobo: p.price_kobo,
            }))}
            offers={offers}
          />
        </section>
      )}
    </div>
  );
}
