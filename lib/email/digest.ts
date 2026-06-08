import type { SupabaseClient } from "@supabase/supabase-js";

import { getFromAddress, getResendClient, REPLY_TO } from "@/lib/email/client";
import { weeklyDigestEmail } from "@/lib/email/templates";

const DIGEST_WINDOW_DAYS = 7;
const MAX_POST_HIGHLIGHTS = 3;
const MS_DAY = 86_400_000;

type DigestUser = {
  userId: string;
  email: string;
  displayName: string;
};

async function buildFanSection(admin: SupabaseClient, userId: string, since: string) {
  const { data: subs } = await admin
    .from("subscriptions")
    .select("creator_id")
    .eq("fan_id", userId)
    .in("status", ["active", "trialing"]);

  const creatorIds = [...new Set((subs ?? []).map((s) => s.creator_id as string))];
  if (!creatorIds.length) return undefined;

  const { data: posts, count } = await admin
    .from("posts")
    .select("creator_id, caption, published_at", { count: "exact" })
    .in("creator_id", creatorIds)
    .eq("status", "published")
    .is("removed_at", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(MAX_POST_HIGHLIGHTS);

  const newPostsCount = count ?? 0;
  if (!newPostsCount) return undefined;

  const highlightCreatorIds = [...new Set((posts ?? []).map((p) => p.creator_id as string))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .in("id", highlightCreatorIds);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const highlights = (posts ?? []).flatMap((post) => {
    const profile = profileById.get(post.creator_id as string);
    if (!profile) return [];
    return [
      {
        creatorName: (profile.display_name as string | null) ?? (profile.username as string),
        creatorUsername: profile.username as string,
        caption: (post.caption as string | null) ?? "",
      },
    ];
  });

  const { data: unread } = await admin.rpc("get_unread_notification_count", {
    p_user_id: userId,
  });

  return {
    newPostsCount,
    highlights,
    unreadNotifications: (unread as number | null) ?? 0,
  };
}

async function buildCreatorSection(admin: SupabaseClient, userId: string, since: string) {
  const { data: wallet } = await admin
    .from("wallets")
    .select("id")
    .eq("owner_id", userId)
    .eq("owner_type", "creator")
    .maybeSingle();
  if (!wallet) return undefined;

  const [{ data: earnings }, { count: newSubscribers }, { count: activeSubscribers }] =
    await Promise.all([
      admin
        .from("earnings_daily")
        .select("gross_kobo")
        .eq("creator_id", userId)
        .gte("date", since.slice(0, 10)),
      admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", userId)
        .gte("created_at", since),
      admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", userId)
        .in("status", ["active", "trialing"]),
    ]);

  const grossKobo = (earnings ?? []).reduce(
    (sum, row) => sum + ((row.gross_kobo as number | null) ?? 0),
    0,
  );

  if (grossKobo === 0 && !newSubscribers && !activeSubscribers) return undefined;

  return {
    grossKobo,
    newSubscribers: newSubscribers ?? 0,
    activeSubscribers: activeSubscribers ?? 0,
  };
}

/**
 * Builds and sends one weekly digest email to a user, combining a "new posts
 * from creators you follow" section (fan side) and an earnings/subscriber
 * recap (creator side) when applicable. Skips silently if there's nothing to
 * report — an empty digest is worse than no digest.
 */
export async function sendWeeklyDigest(admin: SupabaseClient, user: DigestUser): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) return false;

  const since = new Date(Date.now() - DIGEST_WINDOW_DAYS * MS_DAY).toISOString();

  const [fanSection, creatorSection] = await Promise.all([
    buildFanSection(admin, user.userId, since),
    buildCreatorSection(admin, user.userId, since),
  ]);

  if (!fanSection && !creatorSection) return false;

  const { subject, html } = weeklyDigestEmail({
    displayName: user.displayName,
    fanSection,
    creatorSection,
  });

  await resend.emails.send({
    from: getFromAddress(),
    to: user.email,
    replyTo: REPLY_TO,
    subject,
    html,
  });

  return true;
}
