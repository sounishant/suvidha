"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { copy } from "@/content/copy";
import { isSet, telHref } from "@/lib/links";

export function Nav({ phone }: { phone: string }) {
  const { links, call, callShort, menu } = copy.nav;
  const callLabel = (
    <>
      <span className="sm:hidden">{callShort}</span>
      <span className="hidden sm:inline">{call}</span>
    </>
  );
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg">
      <div className="frame relative flex h-[68px] items-center justify-between gap-6">
        <a href="#top" aria-label={`${copy.brand}, back to top`} className="rounded-md">
          <Logo />
        </a>

        <nav aria-label="Sections" className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-small font-medium text-muted transition-colors hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isSet(phone) ? (
            <a href={telHref(phone)} className="btn btn-primary !min-h-10 !px-4 text-small whitespace-nowrap">
              {callLabel}
            </a>
          ) : (
            <span className="btn btn-primary !min-h-10 !px-4 text-small whitespace-nowrap">{callLabel}</span>
          )}
          <button
            type="button"
            aria-expanded={open}
            aria-controls="section-menu"
            onClick={() => setOpen((value) => !value)}
            className="btn btn-quiet !min-h-10 cursor-pointer !px-4 text-small lg:hidden"
          >
            {menu}
          </button>
        </div>

        {open && (
          <nav id="section-menu" aria-label="Sections" className="absolute inset-x-0 top-full border-b border-line bg-bg px-5 py-2 sm:px-8 lg:hidden">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center font-medium">
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
