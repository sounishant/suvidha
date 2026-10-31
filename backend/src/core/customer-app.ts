import { whenLabel } from "../messages.ts";
import type { Session } from "./app-login.ts";
import type { Ctx } from "./context.ts";
import { jobLabel, whenText, type JobStatus } from "./jobs.ts";
import { bookQuote } from "./quotes.ts";

// The web app speaks Hinglish, which is what the "hi" copy file holds for job labels and times.
const APP_LANG = "hi";

type JobListRow = {
  ref: string;
  status: JobStatus;
  trade: string;
  job_type: string | null;
  job_type_other: string | null;
  problem: string | null;
  locality: string | null;
  time_window_text: string | null;
  window_end: Date | null;
  created_at: Date;
  worker_name: string | null;
  eta_at: Date | null;
  final_price_inr: number | null;
  price_inr: number | null;
};

function summary(row: JobListRow, now: Date) {
  return {
    ref: row.ref,
    status: row.status,
    trade: row.trade,
    title: jobLabel({ ...row, language: APP_LANG }),
    locality: row.locality,
    when: whenText({ ...row, language: APP_LANG }, now),
    createdAt: row.created_at.toISOString(),
    worker: row.worker_name,
    eta: row.eta_at ? whenLabel(APP_LANG, row.eta_at, now) : null,
    price: row.final_price_inr ?? row.price_inr,
  };
}

export async function customerJobs(ctx: Ctx, session: Session) {
  const rows = await ctx.sql<JobListRow[]>`
    select j.ref, j.status, j.trade, j.job_type, j.job_type_other, j.problem, j.locality, j.time_window_text,
           j.window_end, j.created_at, j.price_inr, w.name as worker_name, b.eta_at, b.final_price_inr
    from jobs j
    left join bookings b on b.job_id = j.id
    left join workers w on w.id = b.worker_id
    where j.customer_id = ${session.customerId}
    order by j.created_at desc
    limit 50`;
  const now = ctx.now();
  return rows.map((r) => summary(r, now));
}

// Fewer than 3 ratings says little, so the app shows "new" instead (same rule as ranking).
const shownRating = (rating: string | null, count: number) => (count >= 3 && rating ? Number(rating) : null);

type QuoteRow = {
  ref: string;
  worker_name: string;
  rating: string | null;
  rating_count: number;
  verified: boolean;
  price_type: "fixed" | "visit_only" | null;
  price: number | null;
  visit_charge: number | null;
  material_included: "yes" | "no" | "partly" | null;
  earliest_arrival: Date | null;
  distance_km: number | null;
  rank: number;
  rank_group: "ranked" | "visit" | "later" | null;
  rank_reason: string | null;
  note: string | null;
};

type BookingRow = {
  worker_name: string;
  rating: string | null;
  rating_count: number;
  verified: boolean;
  eta_at: Date | null;
  start_otp: string;
  completion_otp: string;
  trip_started_at: Date | null;
  started_at: Date | null;
  done_at: Date | null;
  closed_at: Date | null;
  fixed: boolean | null;
  final_price_inr: number | null;
};

// Only the customer's own job; a ref from someone else's job reads as not found.
export async function customerJob(ctx: Ctx, session: Session, ref: string) {
  const [job] = await ctx.sql<(JobListRow & { id: string; material: string | null; address: string | null; safety_note: string | null; budget_inr: number | null })[]>`
    select j.id, j.ref, j.status, j.trade, j.job_type, j.job_type_other, j.problem, j.locality, j.address, j.material,
           j.safety_note, j.budget_inr, j.time_window_text, j.window_end, j.created_at, j.price_inr,
           w.name as worker_name, b.eta_at, b.final_price_inr
    from jobs j
    left join bookings b on b.job_id = j.id
    left join workers w on w.id = b.worker_id
    where j.ref = ${ref} and j.customer_id = ${session.customerId}`;
  if (!job) return null;
  const now = ctx.now();

  const quotes = await ctx.sql<QuoteRow[]>`
    select q.ref, w.name as worker_name, w.rating, w.rating_count, w.verified, q.price_type, q.price,
           q.visit_charge, q.material_included, q.earliest_arrival, q.distance_km, q.rank, q.rank_group, q.rank_reason, q.note
    from quotes q join workers w on w.id = q.worker_id
    where q.job_id = ${job.id} and q.rank is not null
    order by q.rank`;

  const [booking] = await ctx.sql<BookingRow[]>`
    select w.name as worker_name, w.rating, w.rating_count, w.verified, b.eta_at, b.start_otp, b.completion_otp, b.trip_started_at,
           b.started_at, b.done_at, b.closed_at, b.fixed, b.final_price_inr
    from bookings b join workers w on w.id = b.worker_id where b.job_id = ${job.id}`;

  return {
    ...summary(job, now),
    problem: job.problem,
    address: job.address,
    material: job.material,
    safetyNote: job.safety_note,
    budget: job.budget_inr,
    quotes: quotes.map((q) => ({
      ref: q.ref,
      worker: q.worker_name,
      rating: shownRating(q.rating, q.rating_count),
      verified: q.verified,
      priceType: q.price_type,
      price: q.price,
      visitCharge: q.visit_charge,
      materialIncluded: q.material_included,
      arrives: q.earliest_arrival ? whenLabel(APP_LANG, q.earliest_arrival, now) : null,
      distanceKm: q.distance_km,
      group: q.rank_group,
      reason: q.rank_reason,
      note: q.note,
    })),
    booking: booking
      ? {
          worker: booking.worker_name,
          rating: shownRating(booking.rating, booking.rating_count),
          verified: booking.verified,
          eta: booking.eta_at ? whenLabel(APP_LANG, booking.eta_at, now) : null,
          stage: booking.closed_at ? "closed" : booking.done_at ? "done" : booking.started_at ? "working" : booking.trip_started_at ? "on_the_way" : "booked",
          // The start code is for the door, the finish code only once he says the work is done.
          startCode: booking.started_at ? null : booking.start_otp,
          finishCode: booking.done_at && !booking.closed_at ? booking.completion_otp : null,
          fixed: booking.fixed,
          finalPrice: booking.final_price_inr,
        }
      : null,
  };
}

export async function customerProfile(ctx: Ctx, session: Session) {
  const [c] = await ctx.sql<{ name: string | null }[]>`select name from customers where id = ${session.customerId}`;
  return { phone: session.phone, name: c?.name ?? null };
}

export async function setCustomerName(ctx: Ctx, session: Session, name: string) {
  await ctx.sql`update customers set name = ${name} where id = ${session.customerId}`;
}

// The same booking the WhatsApp list makes; the quote must belong to this customer's job.
export async function bookForCustomer(ctx: Ctx, session: Session, jobRef: string, quoteRef: string) {
  const [match] = await ctx.sql`
    select 1 from quotes q join jobs j on j.id = q.job_id
    where q.ref = ${quoteRef} and j.ref = ${jobRef} and j.customer_id = ${session.customerId}`;
  if (!match) return false;
  return bookQuote(ctx, session.phone, quoteRef);
}
