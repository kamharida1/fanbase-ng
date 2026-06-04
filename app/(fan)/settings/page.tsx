import { Suspense } from "react";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { RoleBadge } from "@/components/auth/role-badge";
import {
  SessionsManager,
  type SessionRow,
} from "@/components/auth/sessions-manager";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  BecomeCreatorCard,
  CreatorStudioLinks,
} from "@/components/creator/become-creator-card";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";

export default async function FanSettingsPage() {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: sessions } = await supabase
    .from("user_sessions")
    .select("id, user_agent, ip_address, last_active_at, created_at")
    .eq("user_id", auth.userId)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Account, security, and active sessions.
        </p>
      </div>

      <Suspense fallback={null}>
        <AuthAlert />
      </Suspense>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Account</h2>
        <dl className="grid max-w-md gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{auth.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Username</dt>
            <dd>@{auth.profile.username}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Display name</dt>
            <dd>{auth.profile.display_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="flex items-center gap-2">
              <RoleBadge role={auth.appRole} />
              <span className="text-muted-foreground">
                {ROLE_LABELS[auth.appRole]}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {auth.profile.role === "creator" ? (
        <CreatorStudioLinks username={auth.profile.username} />
      ) : (
        <BecomeCreatorCard />
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Change password</h2>
        <ChangePasswordForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Active sessions</h2>
        <SessionsManager sessions={(sessions ?? []) as SessionRow[]} />
      </section>
    </div>
  );
}
