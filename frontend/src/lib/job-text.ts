import type { JobStatus, Quote } from "./api";

type StatusText = { label: string; line: string; open: boolean };

export const STATUS: Record<JobStatus, StatusText> = {
  draft: { label: "Details needed", line: "Answer one question below (or on WhatsApp), then we’ll find workers.", open: true },
  confirmed: { label: "Job card ready", line: "Your job card is ready. We’ll start calling workers within a minute.", open: true },
  inviting: { label: "Finding workers", line: "We’re getting prices from nearby workers and will tell you as soon as three are in.", open: true },
  quotes_in: { label: "Prices are in", line: "See the prices below and choose the worker you like.", open: true },
  awaiting_payment: { label: "Booking fee due", line: "Pay the booking fee to confirm your booking. We’ve sent the link on WhatsApp too.", open: true },
  booked: { label: "Worker booked", line: "Your worker is coming. Tell them the start code when they arrive.", open: true },
  done: { label: "Done", line: "This job is complete.", open: false },
  cancelled: { label: "Cancelled", line: "This job was cancelled.", open: false },
  no_workers: { label: "No workers found", line: "Sorry, no worker was free in your area this time.", open: false },
};

// The steps a customer sees; draft and confirmed both count as the first step.
export const STEPS = ["Job card", "Getting prices", "Worker chosen", "Done"] as const;
export function stepOf(status: JobStatus) {
  if (status === "draft" || status === "confirmed") return 0;
  if (status === "inviting" || status === "quotes_in") return 1;
  if (status === "awaiting_payment" || status === "booked") return 2;
  return 3;
}

export const TRADE: Record<string, string> = {
  plumber: "Plumber",
  electrician: "Electrician",
  carpenter: "Carpenter",
  other: "Worker",
};

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function quotePrice(q: Pick<Quote, "priceType" | "price" | "visitCharge">) {
  if (q.priceType === "visit_only") return q.visitCharge ? `Price after visit · visit ${rupees(q.visitCharge)}` : "Price after visit";
  return q.price !== null ? rupees(q.price) : "—";
}

export const MATERIAL: Record<string, string> = {
  customer_has: "You have the material",
  worker_brings: "Worker brings the material",
  not_sure: "Material not decided",
  yes: "Material included",
  no: "Material extra",
  partly: "Some material included",
};

export { rupees };
