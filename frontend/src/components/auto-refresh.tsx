"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Prices, codes and new jobs arrive from calls and WhatsApp, so an open page re-reads them while it's on screen.
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
