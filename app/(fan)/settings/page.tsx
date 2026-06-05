import { Suspense } from "react";
import Link from "next/link";

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
import { AppearanceSection } from "@/components/settings/appearance-section";
import { UpdateProfileForm } from "@/components/settings/update-profile-form";
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
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your profile, appearance, and account security.
        </p>
      </div>

      <Suspense fallback={null}>
        <AuthAlert />
      </Suspense>

      {/* Profile */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Your public display name. Username and email cannot be changed here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge role={auth.appRole} />
          <span className="text-sm text-muted-foreground">
            {ROLE_LABELS[auth.appRole]}
          </span>
        </div>
        <UpdateProfileForm
          email={auth.email}
          username={auth.profile.username}
          displayName={auth.profile.display_name}
        />
      </section>

      {/* Appearance */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Appearance</h2>
          <p className="text-sm text-muted-foreground">
            Customize how the app looks on your device.
          </p>
        </div>
        <AppearanceSection />
      </section>

      {/* Notifications */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Control which notifications you receive and how.
          </p>
        </div>
        <Link
          href="/notifications"
          className="inline-flex items-center gap-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Manage notification preferences →
        </Link>
      </section>

      {/* Creator */}
      {auth.profile.role === "creator" ? (
        <CreatorStudioLinks username={auth.profile.username} />
      ) : (
        <BecomeCreatorCard />
      )}

      {/* Security */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Change password</h2>
          <p className="text-sm text-muted-foreground">
            Update your password. You&apos;ll need your current password to confirm.
          </p>
        </div>
        <ChangePasswordForm />
      </section>

      {/* Sessions */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Active sessions</h2>
          <p className="text-sm text-muted-foreground">
            Devices currently signed in to your account.
          </p>
        </div>
        <SessionsManager sessions={(sessions ?? []) as SessionRow[]} />
      </section>
    </div>
  );
}
