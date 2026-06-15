import Link from "next/link";

import { ProfileEditor } from "@/components/creator/profile-editor";
import { PublicProfileCallout } from "@/components/creator/public-profile-callout";
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Creator profile</h1>
          <p className="mt-2 text-muted-foreground">
            This is what fans see on your public page.
          </p>
        </div>
        {studio.profile?.username ? (
          <Link
            href={`/creators/${studio.profile.username}`}
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            View public profile
          </Link>
        ) : null}
      </div>
      {studio.profile?.username ? (
        <PublicProfileCallout username={studio.profile.username} />
      ) : null}
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
