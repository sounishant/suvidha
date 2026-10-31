"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Nothing happens on the first tap: it shows what will happen and asks again.
export function ConfirmAction({ label, confirmLabel, action, children }: {
  label: string;
  confirmLabel: string;
  action: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button type="button" variant="outline" onClick={() => setAsking(true)} className="h-12 w-full rounded-xl text-base text-destructive">
        {label}
      </Button>
    );
  }
  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5" role="alertdialog" aria-labelledby="confirm-title">
      <p id="confirm-title" className="font-semibold">{label}?</p>
      <div className="grid gap-1 text-base">{children}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Submit label={confirmLabel} />
        <Button type="button" variant="secondary" onClick={() => setAsking(false)} className="h-12 rounded-xl text-base">Keep it</Button>
      </div>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending} className="h-12 rounded-xl text-base">
      {pending ? "Cancelling…" : label}
    </Button>
  );
}
