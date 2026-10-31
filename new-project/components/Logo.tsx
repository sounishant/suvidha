import { copy } from "@/content/copy";

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-accent-text">
      <svg aria-hidden="true" viewBox="0 0 44 44" className="size-[30px]">
        <path d="M3 18.4 22 2.7l19 15.7V40H3z" fill="none" stroke="currentColor" strokeWidth="3.7" strokeLinejoin="round" />
        <circle cx="22" cy="27.2" r="4.4" fill="#ebb73e" />
      </svg>
      <span className="text-[1.75rem] leading-none font-bold tracking-[-0.03em]">{copy.brand.toLowerCase()}</span>
    </span>
  );
}
