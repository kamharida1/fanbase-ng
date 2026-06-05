import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home screen icon (Apple adds the rounded corners automatically)
export default function AppleIcon() {
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
            fontSize: 108,
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          F
        </span>
      </div>
    ),
    size,
  );
}
