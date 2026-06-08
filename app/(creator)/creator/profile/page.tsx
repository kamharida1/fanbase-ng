import { ProfileEditor } from "@/components/creator/profile-editor";
import { VerificationRequestCard } from "@/components/creator/verification-request-card";
import { normalizeSocialLinks } from "@/lib/creators/format";
import { getCreatorStudioProfile } from "@/lib/creators/queries";
import { requireRole } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import type { CreatorProfileRow } from "@/types/creator";

export default async function CreatorProfilePage() {
  const supabase = await createClient();
  const auth = await requireRole(supabase, "creator");
  const studio = await getCreatorStudioProfile(supabase, auth.userId);

  const creatorRow: CreatorProfileRow | null = studio.creator
    ? {
        user_id: studio.creator.user_id,
        bio: studio.creator.bio,
        banner_url: studio.creator.banner_url,
        is_verified: studio.creator.is_verified,
        is_accepting_subscribers: studio.creator.is_accepting_subscribers,
        social_links: normalizeSocialLinks(studio.creator.social_links),
        category: studio.creator.category ?? [],
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Creator profile</h1>
        <p className="mt-2 text-muted-foreground">
          This is what fans see on your public page.
        </p>
      </div>
      <ProfileEditor
        userId={auth.userId}
        username={studio.profile?.username ?? auth.profile.username}
        displayName={
          studio.profile?.display_name ?? auth.profile.display_name ?? ""
        }
        avatarUrl={studio.profile?.avatar_url ?? null}
        creator={creatorRow}
      />

      {!studio.creator?.is_verified && (
        <VerificationRequestCard
          kycStatus={(studio.profile?.kyc_status as "none" | "pending" | "verified" | "rejected") ?? "none"}
          rejectedReason={studio.profile?.verification_rejected_reason ?? null}
          existingNote={studio.profile?.verification_note ?? null}
        />
      )}
    </div>
  );
}
