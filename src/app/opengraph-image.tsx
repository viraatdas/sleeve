import { ImageResponse } from "next/og";

export const alt = "Sleeve — one private place for life’s essential records";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#090f0a";
const PERSIMMON = "#e46e3d";
const MOSS_LIGHT = "#79ca8b";

function SleeveMark({ scale = 1 }: { scale?: number }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: 44 * scale,
        height: 52 * scale,
        transform: "rotate(-4deg)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 6 * scale,
          top: 6 * scale,
          width: 38 * scale,
          height: 46 * scale,
          border: `${2 * scale}px solid rgba(255, 255, 255, 0.4)`,
          borderRadius: 13 * scale,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 38 * scale,
          height: 46 * scale,
          border: `${3 * scale}px solid white`,
          borderRadius: 13 * scale,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 10 * scale,
          top: 6 * scale,
          width: 9 * scale,
          height: 9 * scale,
          borderRadius: 9 * scale,
          background: PERSIMMON,
        }}
      />
    </div>
  );
}

export default function OpengraphImage() {
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
          background: INK,
          color: "white",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -150,
            top: 120,
            width: 440,
            height: 600,
            border: "2px solid rgba(255, 255, 255, 0.11)",
            borderRadius: 60,
            transform: "rotate(8deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -110,
            top: 165,
            width: 440,
            height: 600,
            border: "2px solid rgba(255, 255, 255, 0.05)",
            borderRadius: 60,
            transform: "rotate(8deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 118,
            top: 158,
            width: 18,
            height: 18,
            borderRadius: 18,
            background: PERSIMMON,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <SleeveMark />
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.5 }}>Sleeve</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
          <div style={{ fontSize: 74, fontWeight: 400, lineHeight: 1.04, letterSpacing: -3 }}>
            One private place for life’s essential records.
          </div>
          <div style={{ marginTop: 26, fontSize: 27, lineHeight: 1.4, color: "rgba(255, 255, 255, 0.68)", maxWidth: 660 }}>
            Identity, health, insurance, and immigration documents — easy to find, renew, and share on your terms.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {["Encrypted records", "15-minute share links", "Private source files"].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 10, background: MOSS_LIGHT }} />
              <div style={{ fontSize: 22, color: "rgba(255, 255, 255, 0.75)" }}>{item}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
