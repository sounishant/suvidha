import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="suvidha" className={cn("inline-flex items-center gap-2 text-primary", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <path d="M5 14.5 16 5l11 9.5V27H5z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx="16" cy="19.5" r="2.6" fill="var(--sun)" />
      </svg>
      <span className="text-2xl font-bold tracking-[-0.045em] leading-none">suvidha</span>
    </Link>
  );
}
