import type { Sql, TransactionSql } from "postgres";
import { whatsappText, whenLabel } from "../messages.ts";
import type { Session } from "./app-login.ts";
import type { WorkerQuote } from "./card.ts";
import type { Ctx } from "./context.ts";
import { logEvent } from "./events.ts";
import { jobById, jobLabel, moveJob, whenText, type JobStatus } from "./jobs.ts";
import { toWhatsApp } from "./phone.ts";
import { recordWorkerCall } from "./quotes.ts";

const APP_LANG = "en";
const MAX_CODE_ATTEMPTS = 5;

type InviteRow = {
  ref: string;
  job_ref: string;
  status: JobStatus;
  trade: string;
  job_type: string | null;
  job_type_other: string | null;
  problem: string | null;
  locality: string | null;
  material: string | null;
  safety_note: string | null;
  time_window_text: string | null;
  window_end: Date | null;
  distance_km: number | null;
  quoted_at: Date | null;
  available: boolean | null;
  price_type: WorkerQuote["priceType"];
  price: number | null;
  visit_charge: number | null;
  earliest_arrival: Date | null;
  booked_worker: string | null;
};

type ActiveRow = {
  job_ref: string;
  trade: string;
  job_type: string | null;
  job_type_other: string | null;
  problem: string | null;
  address: string | null;
  locality: string | null;
  site_contact: string | null;
  safety_note: string | null;
  customer_name: string | null;
  customer_phone: string;
  time_window_text: string | null;
  window_end: Date | null;
  eta_at: Date | null;
  trip_started_at: Date | null;
  started_at: Date | null;
  done_at: Date | null;
  price: number | null;
  final_price_inr: number | null;
};

// Before booking a worker sees the area, never the address or the customer's phone (job-card spec, "Who sees what");
// once booked, the worker also gets a number to call the customer on until the job closes.
export async function workerHome(ctx: Ctx, session: Session) {
  const now = ctx.now();
  const [profile] = await ctx.sql<{ name: string; trades: string[]; verified: boolean; rating: string | null; rating_count: number; online: boolean }[]>`
    select name, trades, verified, rating, rating_count, online from workers where id = ${session.workerId}`;

  const quotes = await ctx.sql<InviteRow[]>`
    select q.ref, j.ref as job_ref, j.status, j.trade, j.job_type, j.job_type_other, j.problem, j.locality, j.material,
           j.safety_note, j.time_window_text, j.window_end, q.distance_km, q.quoted_at, q.available, q.price_type,
           q.price, q.visit_charge, q.earliest_arrival, b.worker_id as booked_worker
    from quotes q join jobs j on j.id = q.job_id left join bookings b on b.job_id = j.id
    where q.worker_id = ${session.workerId} and j.status in ('inviting', 'quotes_in', 'awaiting_payment', 'booked')
      and (b.worker_id is null or b.worker_id <> ${session.workerId})
    order by q.called_at desc limit 20`;

  const active = await ctx.sql<ActiveRow[]>`
    select j.ref as job_ref, j.trade, j.job_type, j.job_type_other, j.problem, j.address, j.locality, j.site_contact,
           j.safety_note, c.name as customer_name, c.phone as customer_phone, j.time_window_text, j.window_end, b.eta_at, b.trip_started_at,
           b.started_at, b.done_at, q.price, b.final_price_inr
    from bookings b join jobs j on j.id = b.job_id join customers c on c.id = j.customer_id left join quotes q on q.id = b.quote_id
    where b.worker_id = ${session.workerId} and b.closed_at is null and j.status = 'booked'
    order by b.confirmed_at`;

  const [earned] = await ctx.sql<{ jobs: number; total: number; month_jobs: number; month_total: number }[]>`
    select count(*)::int as jobs, coalesce(sum(final_price_inr), 0)::int as total,
           count(*) filter (where closed_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')::int as month_jobs,
           coalesce(sum(final_price_inr) filter (where closed_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'), 0)::int as month_total
    from bookings where worker_id = ${session.workerId} and closed_at is not null`;

  const recent = await ctx.sql<{ job_ref: string; trade: string; job_type: string | null; job_type_other: string | null; problem: string | null; locality: string | null; closed_at: Date; final_price_inr: number | null }[]>`
    select j.ref as job_ref, j.trade, j.job_type, j.job_type_other, j.problem, j.locality, b.closed_at, b.final_price_inr
    from bookings b join jobs j on j.id = b.job_id
    where b.worker_id = ${session.workerId} and b.closed_at is not null order by b.closed_at desc limit 10`;

  const title = (r: { job_type: string | null; job_type_other: string | null; problem: string | null }) => jobLabel({ ...r, language: APP_LANG });
  return {
    profile: {
      name: profile!.name,
      trades: profile!.trades,
      verified: profile!.verified,
      rating: profile!.rating_count >= 3 && profile!.rating ? Number(profile!.rating) : null,
      online: profile!.online,
    },
    invites: quotes.map((q) => ({
      quoteRef: q.ref,
      jobRef: q.job_ref,
      trade: q.trade,
      title: title(q),
      problem: q.problem,
      locality: q.locality,
      material: q.material,
      safetyNote: q.safety_note,
      when: whenText({ ...q, language: APP_LANG }, now),
      distanceKm: q.distance_km,
      // open: he can still quote; sent: waiting for the customer; closed: the job went elsewhere or ended.
      state: q.status === "inviting" && !q.quoted_at ? "open" : q.quoted_at && q.status !== "booked" ? "sent" : "closed",
      myQuote: q.quoted_at
        ? { available: q.available, priceType: q.price_type, price: q.price, visitCharge: q.visit_charge, arrives: q.earliest_arrival ? whenLabel(APP_LANG, q.earliest_arrival, now) : null }
        : null,
    })),
    active: active.map((a) => ({
      jobRef: a.job_ref,
      trade: a.trade,
      title: title(a),
      problem: a.problem,
      address: a.address ?? a.locality,
      customer: a.site_contact ?? a.customer_name,
      // The customer's own number until masked calling gives a line that hides both sides.
      callNumber: a.customer_phone,
      safetyNote: a.safety_note,
      when: whenText({ ...a, language: APP_LANG }, now),
      eta: a.eta_at ? whenLabel(APP_LANG, a.eta_at, now) : null,
      stage: a.done_at ? "done" : a.started_at ? "working" : a.trip_started_at ? "on_the_way" : "booked",
      price: a.final_price_inr ?? a.price,
    })),
    earnings: { jobs: earned!.jobs, total: earned!.total, monthJobs: earned!.month_jobs, monthTotal: earned!.month_total },
    recent: recent.map((r) => ({ jobRef: r.job_ref, trade: r.trade, title: title(r), locality: r.locality, closedAt: r.closed_at.toISOString(), price: r.final_price_inr })),
  };
}

export async function setOnline(ctx: Ctx, session: Session, online: boolean) {
  await ctx.sql`update workers set online = ${online}, online_at = case when ${online} then now() else online_at end where id = ${session.workerId}`;
}

export type AppQuote = {
  available: boolean;
  declineReason: WorkerQuote["declineReason"];
  priceType: WorkerQuote["priceType"];
  price: number | null;
  visitCharge: number | null;
  materialIncluded: WorkerQuote["materialIncluded"];
  arrivalInMinutes: number | null;
  note: string | null;
};

// The same path as a quote heard on the worker call, so ranking and the shortlist don't care where it came from.
export async function quoteFromApp(ctx: Ctx, session: Session, quoteRef: string, q: AppQuote) {
  const [row] = await ctx.sql<{ id: string; job_id: string; worker_id: string }[]>`
    select q.id, q.job_id, q.worker_id from quotes q join jobs j on j.id = q.job_id
    where q.ref = ${quoteRef} and q.worker_id = ${session.workerId} and q.quoted_at is null and j.status = 'inviting'`;
  if (!row) return false;
  const arrival = q.available && q.arrivalInMinutes !== null ? new Date(ctx.now().getTime() + q.arrivalInMinutes * 60_000) : null;
  await recordWorkerCall(ctx, row, {
    status: "app",
    durationSec: null,
    quote: {
      available: q.available,
      declineReason: q.available ? null : (q.declineReason ?? "other"),
      priceType: q.available ? q.priceType : null,
      price: q.available && q.priceType === "fixed" ? q.price : null,
      visitCharge: q.available && q.priceType === "visit_only" ? q.visitCharge : null,
      materialIncluded: q.available ? q.materialIncluded : null,
      earliestArrival: arrival,
      durationMins: null,
      note: q.note,
    },
  });
  return true;
}

type BookingForWorker = {
  id: string;
  job_id: string;
  start_otp: string;
  completion_otp: string;
  code_attempts: number;
  trip_started_at: Date | null;
  started_at: Date | null;
  done_at: Date | null;
  closed_at: Date | null;
  quote_price: number | null;
  worker_name: string;
};

export type StepReply = { ok: true } | { ok: false; error: "not_found" | "wrong_step" | "wrong_code" | "code_locked" };

async function myBooking(sql: Sql | TransactionSql, session: Session, jobRef: string, lock: boolean) {
  const rows = lock
    ? await sql<BookingForWorker[]>`
        select b.id, b.job_id, b.start_otp, b.completion_otp, b.code_attempts, b.trip_started_at, b.started_at, b.done_at, b.closed_at,
               q.price as quote_price, w.name as worker_name
        from bookings b join jobs j on j.id = b.job_id join workers w on w.id = b.worker_id left join quotes q on q.id = b.quote_id
        where j.ref = ${jobRef} and b.worker_id = ${session.workerId} for update of b`
    : await sql<BookingForWorker[]>`
        select b.id, b.job_id, b.start_otp, b.completion_otp, b.code_attempts, b.trip_started_at, b.started_at, b.done_at, b.closed_at,
               q.price as quote_price, w.name as worker_name
        from bookings b join jobs j on j.id = b.job_id join workers w on w.id = b.worker_id left join quotes q on q.id = b.quote_id
        where j.ref = ${jobRef} and b.worker_id = ${session.workerId}`;
  return rows[0] ?? null;
}

async function tellCustomer(ctx: Ctx, jobId: string, key: string, vars: Record<string, string>) {
  const job = await jobById(ctx.sql, jobId);
  await ctx.whatsapp.sendText(toWhatsApp(job.phone), whatsappText(job.language, key, { job: jobLabel(job), ...vars }));
}

export async function startTrip(ctx: Ctx, session: Session, jobRef: string): Promise<StepReply> {
  const b = await myBooking(ctx.sql, session, jobRef, false);
  if (!b) return { ok: false, error: "not_found" };
  if (b.started_at || b.trip_started_at) return { ok: false, error: "wrong_step" };
  const [moved] = await ctx.sql`update bookings set trip_started_at = now() where id = ${b.id} and trip_started_at is null returning id`;
  if (!moved) return { ok: false, error: "wrong_step" };
  await logEvent(ctx.sql, b.job_id, "trip_started", "worker", {});
  ctx.background(() => tellCustomer(ctx, b.job_id, "on_the_way_customer", { name: b.worker_name, otp: b.start_otp }));
  return { ok: true };
}

// A wrong code counts against the booking; five wrong codes lock it so nobody can guess their way past the customer.
async function checkCode(ctx: Ctx, session: Session, jobRef: string, code: string, which: "start" | "finish", finalPrice?: number | null): Promise<StepReply> {
  return ctx.sql.begin(async (tx) => {
    const b = await myBooking(tx, session, jobRef, true);
    if (!b) return { ok: false as const, error: "not_found" as const };
    const ready = which === "start" ? !b.started_at : Boolean(b.done_at) && !b.closed_at;
    if (!ready) return { ok: false as const, error: "wrong_step" as const };
    if (b.code_attempts >= MAX_CODE_ATTEMPTS) return { ok: false as const, error: "code_locked" as const };
    const expected = which === "start" ? b.start_otp : b.completion_otp;
    if (code !== expected) {
      await tx`update bookings set code_attempts = code_attempts + 1 where id = ${b.id}`;
      return { ok: false as const, error: "wrong_code" as const };
    }
    if (which === "start") {
      await tx`update bookings set started_at = now(), trip_started_at = coalesce(trip_started_at, now()), code_attempts = 0 where id = ${b.id}`;
      await logEvent(tx, b.job_id, "job_started", "worker", {});
    } else {
      await tx`update bookings set closed_at = now(), code_attempts = 0, final_price_inr = coalesce(final_price_inr, ${finalPrice ?? b.quote_price}) where id = ${b.id}`;
      await moveJob(tx, b.job_id, "booked", "done");
      await tx`update customers set completed_jobs = completed_jobs + 1 where id = (select customer_id from jobs where id = ${b.job_id})`;
      await logEvent(tx, b.job_id, "job_closed", "worker", {});
    }
    return { ok: true as const };
  });
}

export const startWork = (ctx: Ctx, session: Session, jobRef: string, code: string) => checkCode(ctx, session, jobRef, code, "start");
export const finishJob = (ctx: Ctx, session: Session, jobRef: string, code: string) => checkCode(ctx, session, jobRef, code, "finish");

// Marking done is the worker's word only; the customer's finish code is what closes the job.
export async function markDone(ctx: Ctx, session: Session, jobRef: string, finalPrice: number | null): Promise<StepReply> {
  const b = await myBooking(ctx.sql, session, jobRef, false);
  if (!b) return { ok: false, error: "not_found" };
  if (!b.started_at || b.done_at) return { ok: false, error: "wrong_step" };
  const price = finalPrice ?? b.quote_price;
  const [moved] = await ctx.sql`update bookings set done_at = now(), final_price_inr = ${price} where id = ${b.id} and done_at is null returning id`;
  if (!moved) return { ok: false, error: "wrong_step" };
  await logEvent(ctx.sql, b.job_id, "job_done", "worker", { final_price_inr: price });
  ctx.background(() =>
    tellCustomer(ctx, b.job_id, "finish_code_customer", {
      name: b.worker_name,
      price: price === null ? "—" : `₹${price}`,
      otp: b.completion_otp,
    }),
  );
  return { ok: true };
}
