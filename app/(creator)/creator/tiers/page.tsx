import { PlansManager, type PlanRow } from "@/components/creator/plans-manager";
import { OfferManager } from "@/components/subscriptions/offer-manager";
import { BundleManager } from "@/components/subscriptions/bundle-manager";
import { getCreatorStudioProfile } from "@/lib/creators/queries";
import { listCreatorOffers } from "@/lib/offers/queries";
import { listCreatorPlanBundles } from "@/lib/subscriptions/bundles";
import { requireRole } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export default async function CreatorTiersPage() {
  const supabase = await createClient();
  const auth = await requireRole(supabase, "creator");
  const [studio, offers, bundles] = await Promise.all([
    getCreatorStudioProfile(supabase, auth.userId),
    listCreatorOffers(supabase, auth.userId),
    listCreatorPlanBundles(supabase, auth.userId),
  ]);

  const plans = (studio.plans ?? []) as PlanRow[];
  const paidPlans = plans.filter((p) => p.billing_interval !== "free" && p.is_active);
  const monthlyPlans = paidPlans.filter((p) => p.billing_interval === "monthly");

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

      {monthlyPlans.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Prepaid bundles</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Let fans commit to 3, 6, or 12 months upfront at a discount —
              a one-time charge with no auto-renewal, shown alongside your
              monthly plan on your profile.
            </p>
          </div>
          <BundleManager
            plans={monthlyPlans.map((p) => ({
              id: p.id,
              name: p.name,
              price_kobo: p.price_kobo,
            }))}
            bundles={bundles}
          />
        </section>
      )}
    </div>
  );
}
