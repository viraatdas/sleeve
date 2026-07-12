import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const INK = "#090f0a";
const PERSIMMON = "#e46e3d";

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
          background: INK,
        }}
      >
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 96,
            height: 116,
            transform: "rotate(-4deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 13,
              top: 13,
              width: 83,
              height: 103,
              border: "4px solid rgba(255, 255, 255, 0.4)",
              borderRadius: 28,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 83,
              height: 103,
              border: "7px solid white",
              borderRadius: 28,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 22,
              top: 14,
              width: 19,
              height: 19,
              borderRadius: 19,
              background: PERSIMMON,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
