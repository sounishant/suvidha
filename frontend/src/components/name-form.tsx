"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveName, type NameState } from "@/app/account/actions";

export function NameForm({ next, defaultName, submitLabel }: { next: "/account" | null; defaultName?: string; submitLabel: string }) {
  const [state, action, pending] = useActionState(saveName.bind(null, next), { error: null, saved: false } as NameState);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="name" className="text-base font-medium">Aapka naam</label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          maxLength={60}
          defaultValue={defaultName}
          placeholder="Jaise: Kavita Sharma"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "name-error" : "name-help"}
          className="h-14 rounded-xl bg-white px-4 text-lg"
          required
        />
        {state.error ? (
          <p id="name-error" className="text-sm text-destructive">{state.error}</p>
        ) : (
          <p id="name-help" className="text-sm text-muted-foreground">Kaarigar aur Priya aapko isi naam se bulayenge.</p>
        )}
      </div>
      <Button type="submit" disabled={pending} className="h-14 rounded-xl text-lg">
        {pending ? "Save ho raha hai…" : submitLabel}
      </Button>
      {state.saved && <p className="text-sm font-medium text-primary" role="status">Naam save ho gaya.</p>}
    </form>
  );
}
