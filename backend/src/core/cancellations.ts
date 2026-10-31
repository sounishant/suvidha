import type { TransactionSql } from "postgres";
import { whatsappText } from "../messages.ts";
import { creditBalance, releasePendingPayment } from "./bookings.ts";
import type { Ctx } from "./context.ts";
import { logEvent } from "./events.ts";
import { cancellationSplit, NO_SHOW_GRACE_MIN, type CancelCause } from "./fees.ts";
import { jobById, jobLabel, moveJob, recordSent, type JobRow, type JobStatus } from "./jobs.ts";
import { toWhatsApp } from "./phone.ts";

type Booked = {
  job_id: string; ref: string; status: string; customer_id: string; customer_phone: string; language: string;
  window_end: Date | null; worker_id: string | null; worker: string | null; worker_phone: string | null; worker_language: string | null;
  eta_at: Date | null; trip_started_at: Date | null; payment_id: string | null; fee_inr: number | null; amount_inr: number | null;
};

const CANCELLABLE = ["quotes_in", "awaiting_payment", "booked"];
const TEAM_CANCELLABLE = ["draft", "confirmed", "inviting", "no_workers", ...CANCELLABLE];

async function findJob(sql: Ctx["sql"] | TransactionSql, ref: string, lock = false) {
  const rows = await sql<Booked[]>`
    select j.id as job_id, j.ref, j.status, j.customer_id, c.phone as customer_phone, j.language, j.window_end,
           b.worker_id, w.name as worker, w.phone as worker_phone, w.language as worker_language, b.eta_at, b.trip_started_at,
           p.id as payment_id, p.fee_inr, p.amount_inr
    from jobs j join customers c on c.id = j.customer_id
    left join bookings b on b.job_id = j.id
    left join workers w on w.id = b.worker_id
    left join payments p on p.job_id = j.id and p.status = 'paid'
    where j.ref = ${ref}
    ${lock ? sql`for update of j` : sql``}`;
  return rows[0] ?? null;
}

function customerCause(b: Booked, now: Date): CancelCause {
  if (b.trip_started_at) return "customer_after_trip";
  const due = b.eta_at ?? b.window_end;
  return due && now.getTime() > due.getTime() + NO_SHOW_GRACE_MIN * 60_000 ? "no_show" : "customer_before_trip";
}

// Bookings made before the booking fee existed have no payment, so nothing is refunded.
const split = (b: Booked, cause: CancelCause) => cancellationSplit({ feeInr: b.fee_inr ?? 0, amountInr: b.amount_inr ?? 0 }, cause);

// What cancelling would cost, told before the customer confirms.
function moneyText(lang: string, b: Booked, cause: CancelCause) {
  const s = split(b, cause);
  if (cause === "customer_after_trip") return whatsappText(lang, "money_travel", { name: b.worker!, travel: s.travelPay, back: s.cashBack + s.creditBack });
  if (cause === "no_show") return whatsappText(lang, "money_no_show", { name: b.worker!, fee: s.cashBack + s.creditBack, apology: s.apology });
  return whatsappText(lang, "money_full", { fee: s.cashBack + s.creditBack });
}

const yesNo = (lang: string, yesId: string) => [
  { id: yesId, title: whatsappText(lang, "button_yes_cancel") },
  { id: "cancel_no", title: whatsappText(lang, "button_no") },
];

// First tap on Cancel: say what it will cost and ask to confirm.
export async function askCustomerCancel(ctx: Ctx, phone: string, ref: string) {
  const b = await findJob(ctx.sql, ref);
  if (!b || b.customer_phone !== phone || !CANCELLABLE.includes(b.status)) return false;
  const text = b.status === "booked"
    ? whatsappText(b.language, "cancel_confirm_booking", { name: b.worker!, money: moneyText(b.language, b, customerCause(b, ctx.now())) })
    : whatsappText(b.language, "cancel_confirm_request");
  await ctx.whatsapp.sendButtons(toWhatsApp(phone), text, yesNo(b.language, `cancel_yes:${ref}`));
  return true;
}

export async function askWorkerCancel(ctx: Ctx, phone: string, ref: string) {
  const b = await findJob(ctx.sql, ref);
  if (!b || b.worker_phone !== phone || b.status !== "booked") return false;
  await ctx.whatsapp.sendButtons(toWhatsApp(phone), whatsappText(b.worker_language, "worker_cancel_confirm"), yesNo(b.worker_language!, `wcancel_yes:${ref}`));
  return true;
}

export async function keepBooking(ctx: Ctx, phone: string) {
  const [who] = await ctx.sql<{ language: string }[]>`
    select coalesce(preferred_language, 'hi') as language from customers where phone = ${phone}
    union all select language from workers where phone = ${phone} limit 1`;
  if (who) await ctx.whatsapp.sendText(toWhatsApp(phone), whatsappText(who.language, "cancel_kept"));
}

export async function customerCancels(ctx: Ctx, phone: string, ref: string) {
  return cancel(ctx, ref, CANCELLABLE, (b) => (b.customer_phone === phone ? (b.status === "booked" ? customerCause(b, ctx.now()) : "customer_before_trip") : null));
}

export async function workerCancels(ctx: Ctx, phone: string, ref: string) {
  return cancel(ctx, ref, CANCELLABLE, (b) => (b.status === "booked" && b.worker_phone === phone ? "worker" : null));
}

// The team cancels a job (npm run cancel-job).
export async function suvidhaCancels(ctx: Ctx, ref: string) {
  return cancel(ctx, ref, TEAM_CANCELLABLE, () => "suvidha");
}

async function cancel(ctx: Ctx, ref: string, statuses: string[], causeFor: (b: Booked) => CancelCause | null) {
  const now = ctx.now();
  const done = await ctx.sql.begin(async (tx) => {
    const b = await findJob(tx, ref, true);
    if (!b || !statuses.includes(b.status)) return null;
    const cause = causeFor(b);
    if (!cause) return null;
    if (b.status !== "booked") {
      await releasePendingPayment(tx, b.job_id, "cancelled");
      await moveJob(tx, b.job_id, b.status as JobStatus, "cancelled");
      await tx`update jobs set next_action_at = null where id = ${b.job_id}`;
      await logEvent(tx, b.job_id, "booking_cancelled", cause === "suvidha" ? "suvidha" : "customer", { cause, booked: false });
      return { b, cause, money: null };
    }
    const money = split(b, cause);
    await moveJob(tx, b.job_id, "booked", "cancelled");
    await tx`update bookings set cancelled_at = ${now}, cancel_cause = ${cause} where job_id = ${b.job_id}`;
    await tx`update payments set refunded_inr = ${money.cashBack}, refunded_at = ${now} where id = ${b.payment_id}`;
    await credit(tx, b, money.creditBack, "refund");
    await credit(tx, b, money.apology, "apology");
    if (money.travelPay) {
      await tx`insert into payouts (worker_id, job_id, amount_inr, reason, provider) values (${b.worker_id}, ${b.job_id}, ${money.travelPay}, 'travel', ${ctx.payments.provider})`;
    }
    if (cause === "no_show") await tx`update workers set last_no_show_at = ${now} where id = ${b.worker_id}`;
    await logEvent(tx, b.job_id, "booking_cancelled", cause.startsWith("customer") || cause === "no_show" ? "customer" : cause, { cause, ...money });
    return { b, cause, money };
  });
  if (!done) return false;

  const { b, cause, money } = done;
  if (money?.cashBack) await ctx.payments.refund({ id: b.payment_id!, amountInr: money.cashBack });
  if (money?.travelPay) await ctx.payments.payout({ workerPhone: b.worker_phone!, amountInr: money.travelPay, jobRef: b.ref });
  await tellCancelled(ctx, await jobById(ctx.sql, b.job_id), b, cause, money);
  return true;
}

async function credit(tx: TransactionSql, b: Booked, amount: number, reason: "refund" | "apology") {
  if (amount) await tx`insert into credits (customer_id, job_id, amount_inr, reason) values (${b.customer_id}, ${b.job_id}, ${amount}, ${reason})`;
}

async function tellCancelled(ctx: Ctx, job: JobRow, b: Booked, cause: CancelCause, money: ReturnType<typeof split> | null) {
  const lang = job.language;
  const balance = await creditBalance(ctx.sql, b.customer_id);
  const text = !money
    ? whatsappText(lang, "cancelled_request")
    : whatsappText(lang, cause === "worker" ? "cancelled_by_worker" : cause === "suvidha" ? "cancelled_by_suvidha" : "cancelled_booking", {
        name: b.worker!,
        refund: money.cashBack ? whatsappText(lang, "refund_line", { amount: money.cashBack }) : "",
        apology: money.apology ? whatsappText(lang, "apology_line", { amount: money.apology }) : "",
        credit: balance ? whatsappText(lang, "credit_balance", { credit: balance }) : "",
      });
  const id = await ctx.whatsapp.sendText(toWhatsApp(job.phone), text);
  await recordSent(ctx, job, "cancelled", id);

  if (money) {
    const wl = b.worker_language!;
    const key = cause === "worker" ? "worker_cancelled_ack" : "worker_job_cancelled";
    await ctx.whatsapp.sendText(toWhatsApp(b.worker_phone!), whatsappText(wl, key, {
      job: jobLabel({ ...job, language: wl }),
      travel: money.travelPay ? whatsappText(wl, "travel_pay_line", { amount: money.travelPay }) : "",
    }));
    return;
  }
  const quoted = await ctx.sql<{ phone: string; language: string }[]>`
    select w.phone, w.language from quotes q join workers w on w.id = q.worker_id
    where q.job_id = ${job.id} and q.rank is not null order by q.call_order`;
  for (const w of quoted) await ctx.whatsapp.sendText(toWhatsApp(w.phone), whatsappText(w.language, "worker_request_cancelled", { job: jobLabel({ ...job, language: w.language }) }));
}

// The worker taps "On my way"; from now a customer cancellation pays the worker's travel.
export async function startTrip(ctx: Ctx, phone: string, ref: string) {
  const [b] = await ctx.sql<{ job_id: string; name: string; worker_language: string; start_otp: string }[]>`
    update bookings b set trip_started_at = ${ctx.now()}
    from jobs j, workers w
    where j.id = b.job_id and w.id = b.worker_id and j.ref = ${ref} and j.status = 'booked'
      and w.phone = ${phone} and b.trip_started_at is null
    returning b.job_id, w.name, w.language as worker_language, b.start_otp`;
  if (!b) return false;
  await logEvent(ctx.sql, b.job_id, "trip_started", "worker");
  const job = await jobById(ctx.sql, b.job_id);
  await ctx.whatsapp.sendText(toWhatsApp(phone), whatsappText(b.worker_language, "worker_trip_ack"));
  const id = await ctx.whatsapp.sendText(toWhatsApp(job.phone), whatsappText(job.language, "on_the_way_customer", { name: b.name, job: jobLabel(job), otp: b.start_otp }));
  await recordSent(ctx, job, "on_the_way_customer", id);
  return true;
}
