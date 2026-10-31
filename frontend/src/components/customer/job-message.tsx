"use client";

import { useActionState } from "react";
import { sendJobMessage, type JobFormState } from "@/app/(app)/account/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Each choice is worded so the backend's reader of WhatsApp replies understands it.
const CHOICES: Record<string, { label: string; value: string }[]> = {
  trade: [
    { label: "Plumber", value: "plumber" },
    { label: "Electrician", value: "electrician" },
    { label: "Carpenter", value: "carpenter" },
  ],
  material: [
    { label: "I have the parts", value: "I have them" },
    { label: "Worker should bring them", value: "worker brings" },
    { label: "Not sure", value: "not sure" },
  ],
  priority: [
    { label: "Earliest arrival", value: "earliest" },
    { label: "Lowest price", value: "lowest price" },
    { label: "Best rated", value: "best rated" },
  ],
};

const NONE: JobFormState = { error: null, done: null };

export function JobQuestion({ jobRef, field, text }: { jobRef: string; field: string; text: string }) {
  const [state, action, pending] = useActionState(sendJobMessage.bind(null, jobRef), NONE);
  const choices = CHOICES[field];
  return (
    <form action={action} className="grid gap-3">
      <p className="text-lg font-medium">{text}</p>
      {choices ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {choices.map((c) => (
            <Button key={c.value} type="submit" name="text" value={c.value} variant="secondary" disabled={pending} className="h-12 rounded-xl text-base">
              {c.label}
            </Button>
          ))}
        </div>
      ) : (
        <>
          <Textarea name="text" required maxLength={500} rows={2} aria-label="Your answer" className="min-h-14 rounded-xl bg-white px-4 py-3 text-base" />
          <Button type="submit" disabled={pending} className="h-12 rounded-xl text-base">{pending ? "Sending…" : "Send answer"}</Button>
        </>
      )}
      <Status state={state} />
    </form>
  );
}

export function JobNote({ jobRef }: { jobRef: string }) {
  const [state, action, pending] = useActionState(sendJobMessage.bind(null, jobRef), NONE);
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="note" className="text-base font-medium">Add a note for the workers</label>
      <Textarea id="note" name="text" required maxLength={500} rows={2} placeholder="e.g. The gate is blue, ring twice" className="min-h-14 rounded-xl bg-white px-4 py-3 text-base" />
      <Button type="submit" variant="secondary" disabled={pending} className="h-12 rounded-xl text-base">{pending ? "Sending…" : "Send note"}</Button>
      <Status state={state} />
    </form>
  );
}

function Status({ state }: { state: JobFormState }) {
  return <p role="status" className={cn("text-sm", state.error ? "text-destructive" : "text-primary")}>{state.error ?? state.done ?? ""}</p>;
}
