import { ImageResponse } from "next/og";
import { copy } from "@/site/content/copy";

export const alt = "Suvidha: one call, three quotes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#1b4fd1",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 52, fontWeight: 700 }}>
        <svg width="56" height="56" viewBox="0 0 44 44">
          <path d="M3 18.4 22 2.7l19 15.7V40H3z" fill="none" stroke="#ffffff" strokeWidth="3.7" strokeLinejoin="round" />
          <circle cx="22" cy="27.2" r="4.4" fill="#ebb73e" />
        </svg>
        {copy.brand.toLowerCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
        <div>{`${copy.hero.headline[0]} ${copy.hero.headline[1]}`}</div>
        <div>{copy.hero.headline[2]}</div>
      </div>
      <div style={{ fontSize: 30 }}>Local carpenters, plumbers and electricians, by phone.</div>
    </div>,
    size,
  );
}
