"use client";

import { useEffect } from "react";

const STAGGER_MS = 75;

// Brings each section's parts in once, in reading order, as the section arrives.
export function Motion() {
  useEffect(() => {
    document.querySelectorAll("section, footer").forEach((section) => {
      section.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el, i) => {
        el.style.setProperty("--delay", `${Math.min(i, 6) * STAGGER_MS}ms`);
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
