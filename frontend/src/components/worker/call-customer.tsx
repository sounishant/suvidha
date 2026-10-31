"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The first tap also shows the number, so a worker on a laptop can dial it from a phone.
export function CallCustomer({ number }: { number: string }) {
  const [shown, setShown] = useState(false);
  return (
    <a
      href={`tel:${number}`}
      onClick={() => setShown(true)}
      className={cn(buttonVariants(), "h-12 rounded-xl text-base tabular-nums")}
    >
      <Phone className="size-4" aria-hidden="true" />
      {shown ? `Call +91 ${number.slice(3, 8)} ${number.slice(8)}` : "Call customer"}
    </a>
  );
}
