"use client";

import { useActionState } from "react";
import { bookingStep, type FormState } from "@/app/worker/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import type { ActiveJob } from "@/lib/api";

// WhatsApp copies the code with its bold markers (*123456*); keep only the digits.
const digitsOnly = (text: string) => text.replace(/\D/g, "");

const NONE: FormState = { error: null };

export function StepPanel({ job }: { job: ActiveJob }) {
  if (job.stage === "booked") return <TripForm jobRef={job.jobRef} />;
  if (job.stage === "on_the_way") return <CodeForm key="start" jobRef={job.jobRef} kind="start" label="Customer ka start code" submit="Kaam shuru kijiye" />;
  if (job.stage === "working") return <DoneForm jobRef={job.jobRef} price={job.price} />;
  return <CodeForm key="finish" jobRef={job.jobRef} kind="finish" label="Customer ka finish code" submit="Kaam band kijiye" />;
}

function TripForm({ jobRef }: { jobRef: string }) {
  const [state, action, pending] = useActionState(bookingStep.bind(null, jobRef, "trip"), NONE);
  return (
    <form action={action} className="grid gap-3">
      <Button type="submit" disabled={pending} className="h-14 rounded-xl text-lg">{pending ? "Bata rahe hain…" : "Nikal pada hoon"}</Button>
      <Error message={state.error} />
    </form>
  );
}

function CodeForm({ jobRef, kind, label, submit }: { jobRef: string; kind: "start" | "finish"; label: string; submit: string }) {
  const [state, action, pending] = useActionState(bookingStep.bind(null, jobRef, kind), NONE);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-3">
        <label htmlFor={`${kind}-code`} className="text-base font-medium">{label}</label>
        <InputOTP pattern={REGEXP_ONLY_DIGITS} pasteTransformer={digitsOnly} id={`${kind}-code`} name="code" maxLength={4} inputMode="numeric" autoComplete="off" aria-invalid={state.error ? true : undefined}>
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3].map((i) => (
              <InputOTPSlot key={i} index={i} className="size-14 rounded-xl border text-2xl font-semibold first:rounded-xl last:rounded-xl" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Error message={state.error} />
      <Button type="submit" disabled={pending} className="h-14 rounded-xl text-lg">{pending ? "Jaanch rahe hain…" : submit}</Button>
    </form>
  );
}

function DoneForm({ jobRef, price }: { jobRef: string; price: number | null }) {
  const [state, action, pending] = useActionState(bookingStep.bind(null, jobRef, "done"), NONE);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="finalPrice" className="text-base font-medium">Final daam</label>
        <div className="flex h-14 items-center rounded-xl border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
          <span className="pl-4 pr-1 text-lg text-muted-foreground">₹</span>
          <Input id="finalPrice" name="finalPrice" inputMode="numeric" pattern="[0-9]*" maxLength={6} defaultValue={price ?? undefined} required
            aria-describedby="finalPrice-hint" className="h-full border-0 bg-transparent text-lg tabular-nums shadow-none focus-visible:ring-0" />
        </div>
        <p id="finalPrice-hint" className="text-sm text-muted-foreground">Customer ko yahi daam WhatsApp pe finish code ke saath dikhega.</p>
      </div>
      <Error message={state.error} />
      <Button type="submit" disabled={pending} className="h-14 rounded-xl text-lg">{pending ? "Bhej rahe hain…" : "Kaam ho gaya"}</Button>
    </form>
  );
}

function Error({ message }: { message: string | null }) {
  return message ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive" role="alert">{message}</p> : null;
}
