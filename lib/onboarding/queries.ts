import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingStatus = {
  hasBio: boolean;
  hasAvatar: boolean;
  hasPlan: boolean;
  hasPost: boolean;
  allDone: boolean;
  completedCount: number;
  totalCount: number;
};

export async function getCreatorOnboardingStatus(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<OnboardingStatus> {
  const [profileResult, planResult, postResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("avatar_url, creator_profiles!inner(bio)")
      .eq("id", creatorId)
      .maybeSingle(),

    supabase
      .from("subscription_plans")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", creatorId)
      .eq("is_active", true)
      .limit(1),

    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", creatorId)
      .eq("status", "published")
      .limit(1),
  ]);

  const profile = profileResult.data;
  const cpRaw = profile?.creator_profiles;
  const creatorBio = Array.isArray(cpRaw)
    ? (cpRaw[0] as { bio?: string | null } | undefined)?.bio
    : (cpRaw as unknown as { bio?: string | null } | null)?.bio;

  const hasBio = Boolean(creatorBio?.trim());
  const hasAvatar = Boolean(profile?.avatar_url?.trim());
  const hasPlan = (planResult.count ?? 0) > 0;
  const hasPost = (postResult.count ?? 0) > 0;

  const completedCount = [hasBio, hasAvatar, hasPlan, hasPost].filter(Boolean).length;
  const totalCount = 4;

  return {
    hasBio,
    hasAvatar,
    hasPlan,
    hasPost,
    allDone: completedCount === totalCount,
    completedCount,
    totalCount,
  };
}
