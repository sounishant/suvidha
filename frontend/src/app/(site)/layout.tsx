import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { Motion } from "@/site/components/Motion";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
  display: "swap",
});

const title = "Suvidha: one call, three quotes";
const description =
  "Describe a job in one phone call, in Hindi or Hinglish. Suvidha calls local carpenters, plumbers and electricians and sends you the best rates on WhatsApp.";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1d40" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {children}
        <Motion />
      </body>
    </html>
  );
}
