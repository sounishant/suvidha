import type { ActiveJob, Invite } from "./api";
import { quotePrice } from "./job-text";

export const STAGE: Record<ActiveJob["stage"], { label: string; next: string }> = {
  booked: { label: "Booked", next: "Nikalte waqt “Nikal pada” dabaiye. Customer ko start code mil jayega." },
  on_the_way: { label: "Raste mein", next: "Pahunch ke customer se 4 ank ka start code poochiye aur yahan daaliye." },
  working: { label: "Kaam chalu", next: "Kaam pura hone pe final daam daal ke “Kaam ho gaya” dabaiye." },
  done: { label: "Code baaki", next: "Customer ko WhatsApp pe finish code gaya hai. Wo code daal ke kaam band kijiye." },
};

export const WORKER_STEPS = ["Booked", "Raste mein", "Kaam chalu", "Kaam pura"] as const;
export const stepIndex = (stage: ActiveJob["stage"]) => ["booked", "on_the_way", "working", "done"].indexOf(stage);

export const ARRIVAL = [
  { minutes: 30, label: "30 minute" },
  { minutes: 60, label: "1 ghanta" },
  { minutes: 120, label: "2 ghante" },
  { minutes: 240, label: "4 ghante" },
  { minutes: 1440, label: "Kal" },
] as const;

export const DECLINE = [
  { value: "busy", label: "Abhi khaali nahi hoon" },
  { value: "too_far", label: "Bahut door hai" },
  { value: "not_my_skill", label: "Ye mera kaam nahi" },
  { value: "other", label: "Koi aur wajah" },
] as const;

export function myQuoteText(q: NonNullable<Invite["myQuote"]>) {
  if (q.available === false) return "Aapne mana kiya";
  return [quotePrice(q), q.arrives ? `pahunch: ${q.arrives}` : null].filter(Boolean).join(" · ");
}

// The job card's material field, worded for the worker rather than the customer.
export const JOB_MATERIAL: Record<string, string> = {
  customer_has: "Saaman customer ke paas hai",
  worker_brings: "Saaman aapko laana hai",
  not_sure: "Saaman pakka nahi",
};
