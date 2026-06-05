import { redirect } from "next/navigation";

import { FanManager } from "@/components/fans/fan-manager";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { listCreatorFans } from "@/lib/fans/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function CreatorFansPage() {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") redirect("/settings");

  const admin = createAdminClient();
  const fans = await listCreatorFans(admin, auth.userId, 100);

  const active = fans.filter((f) =>
    ["active", "trialing"].includes(f.subscription_status),
  );
  const others = fans.filter(
    (f) => !["active", "trialing"].includes(f.subscription_status),
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Fans</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your subscribers and block fans who violate your community
          rules.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Active subscribers{" "}
          <span className="text-muted-foreground font-normal">
            ({active.length})
          </span>
        </h2>
        <FanManager fans={active} />
      </section>

      {others.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">
            Past subscribers{" "}
            <span className="text-muted-foreground font-normal">
              ({others.length})
            </span>
          </h2>
          <FanManager fans={others} />
        </section>
      )}
    </div>
  );
}
