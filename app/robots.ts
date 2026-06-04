import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://fanbaseng.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/creators", "/creators/"],
        disallow: [
          "/feed",
          "/discover",
          "/subscriptions",
          "/messages",
          "/notifications",
          "/settings",
          "/creator/",
          "/admin/",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
