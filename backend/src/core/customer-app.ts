import { MAX_PHOTO_BYTES, PHOTO_TYPES, type Media } from "../clients/whatsapp.ts";
import { label, whatsappText, whenLabel } from "../messages.ts";
import type { Session } from "./app-login.ts";
import { chooseQuote, creditBalance } from "./bookings.ts";
import type { RequiredField } from "./card.ts";
import { customerCancels, customerCancelTerms } from "./cancellations.ts";
import type { Ctx } from "./context.ts";
import { bookingFee, type CancelCause } from "./fees.ts";
import { addAppPhoto, answerFollowup, jobLabel, noteCustomerChange, photoLink, whenText, type JobStatus } from "./jobs.ts";
import { forwardPhoto, quoteReasons } from "./quotes.ts";
import type { RankedQuote } from "./ranking.ts";

// The web app is in English whatever language the customer called in.
const APP_LANG = "en";

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
  id: string;
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
  cancelled_at: Date | null;
  cancel_cause: CancelCause | null;
  fixed: boolean | null;
  final_price_inr: number | null;
};

type JobDetailRow = JobListRow & {
  id: string; material: string | null; address: string | null; safety_note: string | null; budget_inr: number | null;
  ranking: RankedQuote[] | null; photo_url: string | null; pending_question: RequiredField | null; customer_notes: string[]; priorities: string[];
};

// Only the customer's own job; a ref from someone else's job reads as not found.
export async function customerJob(ctx: Ctx, session: Session, ref: string) {
  const [job] = await ctx.sql<JobDetailRow[]>`
    select j.id, j.ref, j.status, j.trade, j.job_type, j.job_type_other, j.problem, j.locality, j.address, j.material,
           j.safety_note, j.budget_inr, j.time_window_text, j.window_end, j.created_at, j.price_inr, j.ranking,
           j.photo_url, j.pending_question, j.customer_notes, j.priorities,
           w.name as worker_name, b.eta_at, b.final_price_inr
    from jobs j
    left join bookings b on b.job_id = j.id
    left join workers w on w.id = b.worker_id
    where j.ref = ${ref} and j.customer_id = ${session.customerId}`;
  if (!job) return null;
  const now = ctx.now();

  const quotes = await ctx.sql<QuoteRow[]>`
    select q.id, q.ref, w.name as worker_name, w.rating, w.rating_count, w.verified, q.price_type, q.price,
           q.visit_charge, q.material_included, q.earliest_arrival, q.distance_km, q.rank, q.rank_group, q.note
    from quotes q join workers w on w.id = q.worker_id
    where q.job_id = ${job.id} and q.rank is not null
    order by q.rank`;

  const [booking] = await ctx.sql<BookingRow[]>`
    select w.name as worker_name, w.rating, w.rating_count, w.verified, b.eta_at, b.start_otp, b.completion_otp, b.trip_started_at,
           b.started_at, b.done_at, b.closed_at, b.cancelled_at, b.cancel_cause, b.fixed, b.final_price_inr
    from bookings b join workers w on w.id = b.worker_id where b.job_id = ${job.id}`;

  const reasons = quoteReasons(APP_LANG, job.ranking ?? [], quotes.map((q) => ({
    id: q.id, price: q.price, rating: q.rating === null ? null : Number(q.rating), rated_jobs: q.rating_count, earliest_arrival: q.earliest_arrival,
  })), now);

  const [payment] = await ctx.sql<{ fee_inr: number; credit_inr: number; amount_inr: number; link: string | null }[]>`
    select fee_inr, credit_inr, amount_inr, link from payments where job_id = ${job.id} and status = 'pending' and expires_at > ${now}`;

  const [cancelTerms, photoUrl, cancelled] = await Promise.all([
    customerCancelTerms(ctx, session.phone, job.ref),
    photoLink(ctx, job.photo_url),
    job.status === "cancelled" ? cancelledMoney(ctx, job.id) : null,
  ]);

  return {
    ...summary(job, now),
    problem: job.problem,
    address: job.address,
    material: job.material,
    safetyNote: job.safety_note,
    budget: job.budget_inr,
    priorities: job.priorities.map((p) => label(APP_LANG, "priority", p)),
    notes: job.customer_notes,
    photoUrl,
    question: job.status === "draft" && job.pending_question
      ? { field: job.pending_question, text: whatsappText(APP_LANG, `ask_${job.pending_question}`) }
      : null,
    canCancel: cancelTerms,
    cancelled: cancelled && { by: booking?.cancel_cause ?? null, worker: booking?.worker_name ?? null, ...cancelled },
    quotes: quotes.map((q) => ({
      ref: q.ref,
      worker: q.worker_name,
      rating: shownRating(q.rating, q.rating_count),
      verified: q.verified,
      priceType: q.price_type,
      price: q.price,
      visitCharge: q.visit_charge,
      fee: bookingFee(q.price ?? q.visit_charge ?? 0),
      materialIncluded: q.material_included,
      arrives: q.earliest_arrival ? whenLabel(APP_LANG, q.earliest_arrival, now) : null,
      distanceKm: q.distance_km,
      group: q.rank_group,
      reason: reasons.get(q.id) ?? null,
      note: q.note,
    })),
    payment: payment?.link ? { fee: payment.fee_inr, credit: payment.credit_inr, amount: payment.amount_inr, url: payment.link } : null,
    booking: booking
      ? {
          worker: booking.worker_name,
          rating: shownRating(booking.rating, booking.rating_count),
          verified: booking.verified,
          eta: booking.eta_at ? whenLabel(APP_LANG, booking.eta_at, now) : null,
          stage: booking.cancelled_at ? "cancelled" : booking.closed_at ? "closed" : booking.done_at ? "done" : booking.started_at ? "working" : booking.trip_started_at ? "on_the_way" : "booked",
          // The start code is for the door, the finish code only once he says the work is done; neither after a cancellation.
          startCode: booking.started_at || booking.cancelled_at ? null : booking.start_otp,
          finishCode: booking.done_at && !booking.closed_at && !booking.cancelled_at ? booking.completion_otp : null,
          fixed: booking.fixed,
          finalPrice: booking.final_price_inr,
        }
      : null,
  };
}

// What came back after a cancellation: cash to the way they paid, plus credit for the next booking.
async function cancelledMoney(ctx: Ctx, jobId: string) {
  const [row] = await ctx.sql<{ refund: number; credit: number }[]>`
    select coalesce((select sum(refunded_inr) from payments where job_id = ${jobId}), 0)::int as refund,
           coalesce((select sum(amount_inr) from credits where job_id = ${jobId} and reason in ('refund', 'apology')), 0)::int as credit`;
  return row!;
}

export async function customerProfile(ctx: Ctx, session: Session) {
  const [c] = await ctx.sql<{ name: string | null }[]>`select name from customers where id = ${session.customerId}`;
  return { phone: session.phone, name: c?.name ?? null, credit: await creditBalance(ctx.sql, session.customerId!) };
}

export async function setCustomerName(ctx: Ctx, session: Session, name: string) {
  await ctx.sql`update customers set name = ${name} where id = ${session.customerId}`;
}

// The same choice the WhatsApp list makes; the quote must belong to this customer's job.
export async function bookForCustomer(ctx: Ctx, session: Session, jobRef: string, quoteRef: string) {
  const [match] = await ctx.sql`
    select 1 from quotes q join jobs j on j.id = q.job_id
    where q.ref = ${quoteRef} and j.ref = ${jobRef} and j.customer_id = ${session.customerId}`;
  if (!match) return false;
  return chooseQuote(ctx, session.phone, quoteRef);
}

// Typed in the app as on WhatsApp: the answer to a waiting question, otherwise a note passed to the workers.
export async function messageForJob(ctx: Ctx, session: Session, ref: string, text: string) {
  if (await answerFollowup(ctx, session.phone, text, ref)) return "answered";
  return (await noteCustomerChange(ctx, session.phone, text, ref)) ? "noted" : null;
}

const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/webp": (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
};

// The bytes must really be the photo type they claim, since workers open the stored file.
export async function photoForJob(ctx: Ctx, session: Session, ref: string, media: Media) {
  return photoForCustomer(ctx, session.phone, ref, media);
}

export async function photoForCustomer(ctx: Ctx, phone: string, ref: string, media: Media) {
  if (!PHOTO_TYPES.includes(media.mimeType) || media.bytes.byteLength > MAX_PHOTO_BYTES || !SIGNATURES[media.mimeType]!(media.bytes)) return "bad_photo";
  const photo = await addAppPhoto(ctx, phone, ref, media);
  if (!photo) return "not_open";
  if (!photo.path) return "not_stored";
  if (photo.status === "inviting" || photo.status === "quotes_in") await forwardPhoto(ctx, photo.jobId);
  return "saved";
}

export async function cancelForCustomer(ctx: Ctx, session: Session, ref: string) {
  return customerCancels(ctx, session.phone, ref);
}
