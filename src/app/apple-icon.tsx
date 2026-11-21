import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Hamo Home Equity mark: a bold "H" on the brand blue gradient.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 55%, #3B82F6 100%)",
          borderRadius: 36,
          color: "white",
          fontSize: 128,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        H
      </div>
    ),
    { ...size }
  );
}
