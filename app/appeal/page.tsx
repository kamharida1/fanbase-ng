import { redirect } from "next/navigation";

import { AppealForm } from "@/components/appeals/appeal-form";
import { getMyLatestAppeal } from "@/lib/appeals/queries";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getDefaultPathForRole } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";

export default async function AppealPage() {
  const supabase = await createClient();
  const ctx = await getAuthContext(supabase);

  if (!ctx) {
    redirect("/login?next=/appeal");
  }

  if (ctx.profile.status !== "suspended" && ctx.profile.status !== "banned") {
    redirect(getDefaultPathForRole(ctx.appRole));
  }

  const appeal = await getMyLatestAppeal(supabase, ctx.userId);

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">Account appeal</h1>
        <p className="mt-2 text-muted-foreground">
          Your account is currently <strong>{ctx.profile.status}</strong>. If
          you believe this is a mistake, you can submit a written appeal for
          our team to review.
        </p>
      </div>
      <AppealForm appeal={appeal} />
    </div>
  );
}
