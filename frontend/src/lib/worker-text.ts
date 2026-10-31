import type { ActiveJob, Invite } from "./api";
import { quotePrice } from "./job-text";

export const STAGE: Record<ActiveJob["stage"], { label: string; next: string }> = {
  booked: { label: "Booked", next: "Tap “I’m on my way” when you leave. The customer then gets the start code." },
  on_the_way: { label: "On the way", next: "When you arrive, ask the customer for the 4-digit start code and enter it here." },
  working: { label: "Working", next: "When the work is finished, enter the final price and tap “Work done”." },
  done: { label: "Code pending", next: "The customer got a finish code on WhatsApp. Enter it to close the job." },
};

export const WORKER_STEPS = ["Booked", "On the way", "Working", "Done"] as const;
export const stepIndex = (stage: ActiveJob["stage"]) => ["booked", "on_the_way", "working", "done"].indexOf(stage);

export const ARRIVAL = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 1440, label: "Tomorrow" },
] as const;

export const DECLINE = [
  { value: "busy", label: "I’m busy" },
  { value: "too_far", label: "Too far" },
  { value: "not_my_skill", label: "Not my kind of work" },
  { value: "other", label: "Other reason" },
] as const;

export function myQuoteText(q: NonNullable<Invite["myQuote"]>) {
  if (q.available === false) return "You said no";
  return [quotePrice(q), q.arrives ? `arrive ${q.arrives}` : null].filter(Boolean).join(" · ");
}

// The job card's material field, worded for the worker rather than the customer.
export const JOB_MATERIAL: Record<string, string> = {
  customer_has: "Customer has the material",
  worker_brings: "You bring the material",
  not_sure: "Material not decided",
};
