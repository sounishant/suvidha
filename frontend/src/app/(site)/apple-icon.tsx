import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1b4fd1" }}>
      <svg width="116" height="116" viewBox="0 0 44 44">
        <path d="M3 18.4 22 2.7l19 15.7V40H3z" fill="none" stroke="#ffffff" strokeWidth="3.7" strokeLinejoin="round" />
        <circle cx="22" cy="27.2" r="4.4" fill="#ebb73e" />
      </svg>
    </div>,
    size,
  );
}
