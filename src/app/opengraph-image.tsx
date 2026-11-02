import { ImageResponse } from "next/og";

export const alt = "Revenant: some links come back wrong";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(circle at 15% 0%, #2a2112 0%, #0b0a0e 55%)",
          color: "#ece6d8",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: "#f0b44c" }}>REVENANT</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 80, lineHeight: 1.05 }}>
            Some links come back&nbsp;<span style={{ color: "#ff5c63", fontStyle: "italic" }}>wrong.</span>
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 32, color: "#b9b1a4", fontFamily: "sans-serif" }}>
            Find citations taken over by squatters, soft 404s and rewritten pages. Raise the original from the archive.
          </div>
        </div>
        <div style={{ display: "flex", gap: 30, fontSize: 26, fontFamily: "sans-serif" }}>
          {[
            ["possessed", "#ff5c63"],
            ["changeling", "#b79cff"],
            ["ghost", "#8fd3f4"],
            ["buried", "#a3a0aa"],
            ["alive", "#7fd17f"],
          ].map(([label, color]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, color }}>
              <div style={{ width: 14, height: 18, borderRadius: "7px 7px 2px 2px", background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
