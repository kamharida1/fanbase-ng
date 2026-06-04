import { ImageResponse } from "next/og";

import { getCreatorByUsername } from "@/lib/creators/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_NAME } from "@/config/constants";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ username: string }> };

export default async function CreatorOgImage({ params }: Props) {
  const { username } = await params;

  let displayName = username;
  let bio = "";
  let isVerified = false;

  try {
    const admin = createAdminClient();
    const creator = await getCreatorByUsername(admin as never, username);
    if (creator) {
      displayName = creator.display_name ?? creator.username;
      bio = creator.bio ?? "";
      isVerified = creator.is_verified;
    }
  } catch {
    // Fall through to defaults
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "400px",
            height: "400px",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontSize: "18px",
                color: "#94a3b8",
                letterSpacing: "0.05em",
              }}
            >
              {APP_NAME}
            </span>
            {isVerified && (
              <span
                style={{
                  background: "#6366f1",
                  color: "#fff",
                  fontSize: "12px",
                  padding: "2px 10px",
                  borderRadius: "999px",
                  fontWeight: 600,
                }}
              >
                Verified
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: "64px",
              fontWeight: 800,
              color: "#f1f5f9",
              lineHeight: 1.1,
              maxWidth: "900px",
            }}
          >
            {displayName}
          </div>

          <div
            style={{
              fontSize: "18px",
              color: "#94a3b8",
            }}
          >
            @{username}
          </div>

          {bio && (
            <div
              style={{
                fontSize: "22px",
                color: "#cbd5e1",
                maxWidth: "800px",
                lineHeight: 1.5,
                marginTop: "8px",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {bio}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
