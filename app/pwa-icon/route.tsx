import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = parseInt(searchParams.get("size") ?? "192", 10);
  const size = Number.isFinite(raw) ? Math.min(Math.max(raw, 32), 512) : 192;

  // For maskable icons the "safe zone" is 80% of the icon — keep the logo
  // within the inner 60% so it's never clipped by circular/squircle masks.
  const logoPx = Math.round(size * 0.5);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontSize: logoPx,
            fontWeight: 800,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: "-0.05em",
            lineHeight: 1,
          }}
        >
          F
        </span>
      </div>
    ),
    { width: size, height: size },
  );
}
