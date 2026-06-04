import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

function createSitemapClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://fanbaseng.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/creators`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.4 },
    {
      url: `${base}/legal/terms`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  try {
    const supabase = createSitemapClient();
    const { data: creators } = await supabase
      .from("creator_profiles")
      .select(
        "user_id, updated_at, profiles!inner(username, status, deleted_at, role)",
      )
      .eq("profiles.role", "creator")
      .eq("profiles.status", "active")
      .is("profiles.deleted_at", null)
      .eq("is_accepting_subscribers", true)
      .limit(1000);

    const creatorRoutes: MetadataRoute.Sitemap = (creators ?? []).flatMap(
      (row) => {
        const profile = Array.isArray(row.profiles)
          ? row.profiles[0]
          : row.profiles;
        if (!profile?.username) return [];
        return [
          {
            url: `${base}/creators/${profile.username}`,
            lastModified: row.updated_at ?? undefined,
            changeFrequency: "daily" as const,
            priority: 0.7,
          },
        ];
      },
    );

    return [...staticRoutes, ...creatorRoutes];
  } catch {
    return staticRoutes;
  }
}
