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
        <label htmlFor="name" className="text-base font-medium">Your name</label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          maxLength={60}
          defaultValue={defaultName}
          placeholder="e.g. Kavita Sharma"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "name-error" : "name-help"}
          className="h-14 rounded-xl bg-white px-4 text-lg"
          required
        />
        {state.error ? (
          <p id="name-error" className="text-sm text-destructive">{state.error}</p>
        ) : (
          <p id="name-help" className="text-sm text-muted-foreground">Workers and Priya will call you by this name.</p>
        )}
      </div>
      <Button type="submit" disabled={pending} className="h-14 rounded-xl text-lg">
        {pending ? "Saving…" : submitLabel}
      </Button>
      {state.saved && <p className="text-sm font-medium text-primary" role="status">Name saved.</p>}
    </form>
  );
}
