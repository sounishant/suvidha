import type { Metadata } from "next";
import { Figtree, Hind } from "next/font/google";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const hind = Hind({ variable: "--font-hind", subsets: ["devanagari"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "suvidha",
  description: "Ghar ka har kaam, ek call door. Roorkee.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hi-Latn" className={`${figtree.variable} ${hind.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
