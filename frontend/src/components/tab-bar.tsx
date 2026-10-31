"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { CalendarCheck, House, UserRound, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = {
  customer: [
    { href: "/account", label: "Home", Icon: House, match: (p: string) => p === "/account" || p.startsWith("/account/book/") },
    { href: "/account/bookings", label: "Bookings", Icon: CalendarCheck, match: (p: string) => p.startsWith("/account/bookings") || p.startsWith("/account/jobs/") },
    { href: "/account/profile", label: "Account", Icon: UserRound, match: (p: string) => p.startsWith("/account/profile") },
  ],
  worker: [
    { href: "/worker", label: "Jobs", Icon: House, match: (p: string) => p === "/worker" || p.startsWith("/worker/quote/") || p.startsWith("/worker/jobs/") },
    { href: "/worker/earnings", label: "Earnings", Icon: Wallet, match: (p: string) => p.startsWith("/worker/earnings") },
    { href: "/worker/profile", label: "Account", Icon: UserRound, match: (p: string) => p.startsWith("/worker/profile") },
  ],
};

type Area = keyof typeof TABS;
type Variant = "bottom" | "top";

// Bottom bar on phones, a row of tabs in the header on wider screens.
export function TabBar({ variant, area = "customer" }: { variant: Variant; area?: Area }) {
  return (
    <Suspense fallback={<Tabs variant={variant} area={area} path="" />}>
      <ActiveTabs variant={variant} area={area} />
    </Suspense>
  );
}

// Reading the URL waits for the request, so the links render first and the highlight follows.
function ActiveTabs({ variant, area }: { variant: Variant; area: Area }) {
  return <Tabs variant={variant} area={area} path={usePathname()} />;
}

function Tabs({ variant, area, path }: { variant: Variant; area: Area; path: string }) {
  return (
    <nav aria-label="Main" className={variant === "bottom" ? "fixed inset-x-0 bottom-0 z-20 border-t bg-white pb-[env(safe-area-inset-bottom)] sm:hidden" : "hidden sm:flex"}>
      <ul className={cn(variant === "bottom" ? "grid grid-cols-3" : "flex gap-1")}>
        {TABS[area].map(({ href, label, Icon, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  variant === "bottom"
                    ? "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium"
                    : "flex h-10 items-center gap-2 rounded-xl px-4 text-base font-medium",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  variant === "top" && active && "bg-secondary",
                )}
              >
                <Icon className={variant === "bottom" ? "size-6" : "size-4"} aria-hidden="true" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
