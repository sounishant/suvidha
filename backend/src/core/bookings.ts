import { randomInt } from "node:crypto";
import type { TransactionSql } from "postgres";
import { priceLabel, whatsappText, whenLabel } from "../messages.ts";
import type { Ctx } from "./context.ts";
import { logEvent } from "./events.ts";
import { bookingFee } from "./fees.ts";
import { jobById, jobLabel, moveJob, recordSent, whenText, type JobRow } from "./jobs.ts";
import { toWhatsApp } from "./phone.ts";

const otp = () => String(randomInt(0, 10_000)).padStart(4, "0");

export const creditBalance = async (sql: Ctx["sql"] | TransactionSql, customerId: string) =>
  (await sql<{ balance: number }[]>`select coalesce(sum(amount_inr), 0)::int as balance from credits where customer_id = ${customerId}`)[0]!.balance;

type Released = { job_id: string; customer_id: string; credit_inr: number };

// Credit held for a payment that won't happen goes back to the customer.
async function release(tx: TransactionSql, payments: Released[], why: string) {
  for (const p of payments) {
    if (p.credit_inr) await tx`insert into credits (customer_id, job_id, amount_inr, reason) values (${p.customer_id}, ${p.job_id}, ${p.credit_inr}, 'released')`;
    await logEvent(tx, p.job_id, "payment_expired", "system", { why });
  }
}

export async function releasePendingPayment(tx: TransactionSql, jobId: string, why: string) {
  const rows = await tx<Released[]>`
    update payments set status = 'expired' where job_id = ${jobId} and status = 'pending' returning job_id, customer_id, credit_inr`;
  await release(tx, rows, why);
}

const quoteAmount = (q: { price: number | null; visit_charge: number | null }) => q.price ?? q.visit_charge ?? 0;

function priceText(lang: string, q: { price: number | null; visit_charge: number | null }) {
  if (q.price !== null) return priceLabel(lang, q.price);
  return q.visit_charge !== null ? whatsappText(lang, "visit_price", { price: q.visit_charge }) : whatsappText(lang, "none");
}

// The customer picks a worker: the booking waits for the fee, paid from credit first. payUrl is null when credit covered it.
export async function chooseQuote(ctx: Ctx, phone: string, quoteRef: string): Promise<{ payUrl: string | null } | false> {
  const now = ctx.now();
  const expiresAt = new Date(now.getTime() + ctx.limits.paymentWindowSec * 1000);
  const plan = await ctx.sql.begin(async (tx) => {
    const [row] = await tx<{ quote_id: string; job_id: string; status: string; customer_id: string; price: number | null; visit_charge: number | null }[]>`
      select q.id as quote_id, q.job_id, j.status, j.customer_id, q.price, q.visit_charge
      from quotes q join jobs j on j.id = q.job_id join customers c on c.id = j.customer_id
      where q.ref = ${quoteRef} and c.phone = ${phone} and q.rank is not null
      for update of j, c`;
    if (!row) return null;
    if (row.status === "awaiting_payment") await releasePendingPayment(tx, row.job_id, "chose_again");
    else if (row.status !== "quotes_in" || !(await moveJob(tx, row.job_id, "quotes_in", "awaiting_payment"))) return null;

    const fee = bookingFee(quoteAmount(row));
    const credit = Math.min(fee, await creditBalance(tx, row.customer_id));
    const [payment] = await tx<{ id: string }[]>`
      insert into payments (job_id, quote_id, customer_id, fee_inr, credit_inr, amount_inr, provider, expires_at)
      values (${row.job_id}, ${row.quote_id}, ${row.customer_id}, ${fee}, ${credit}, ${fee - credit}, ${ctx.payments.provider}, ${expiresAt})
      returning id`;
    if (credit) await tx`insert into credits (customer_id, job_id, amount_inr, reason) values (${row.customer_id}, ${row.job_id}, ${-credit}, 'used')`;
    await tx`update jobs set next_action_at = ${expiresAt} where id = ${row.job_id}`;
    await logEvent(tx, row.job_id, "payment_requested", "customer", { quote: quoteRef, fee, credit });
    return { paymentId: payment!.id, jobId: row.job_id, fee, credit, quote: row };
  });
  if (!plan) return false;
  if (plan.fee === plan.credit) return (await payBooking(ctx, plan.paymentId)) === "paid" && { payUrl: null };

  const job = await jobById(ctx.sql, plan.jobId);
  const [worker] = await ctx.sql<{ name: string }[]>`select w.name from quotes q join workers w on w.id = q.worker_id where q.id = ${plan.quote.quote_id}`;
  const amount = plan.fee - plan.credit;
  const link = await ctx.payments.createLink({ id: plan.paymentId, amountInr: amount });
  await ctx.sql`update payments set link = ${link} where id = ${plan.paymentId}`;
  const lang = job.language;
  const id = await ctx.whatsapp.sendText(toWhatsApp(job.phone), whatsappText(lang, "payment_request", {
    name: worker!.name, fee: plan.fee, amount, link, price: priceText(lang, plan.quote),
    minutes: Math.round(ctx.limits.paymentWindowSec / 60),
    credit: plan.credit ? whatsappText(lang, "credit_applied", { credit: plan.credit, amount }) : "",
  }));
  await recordSent(ctx, job, "payment_request", id);
  return { payUrl: link };
}

export type PaymentView = { amountInr: number; worker: string; job: string; status: "pending" | "paid" | "expired" };

export async function paymentView(ctx: Ctx, paymentId: string): Promise<PaymentView | null> {
  const [p] = await ctx.sql<{ amount_inr: number; worker: string; job_id: string; status: string; expires_at: Date }[]>`
    select p.amount_inr, w.name as worker, p.job_id, p.status, p.expires_at
    from payments p join quotes q on q.id = p.quote_id join workers w on w.id = q.worker_id where p.id = ${paymentId}`;
  if (!p) return null;
  const job = await jobById(ctx.sql, p.job_id);
  const status = p.status === "pending" && p.expires_at <= ctx.now() ? "expired" : (p.status as PaymentView["status"]);
  return { amountInr: p.amount_inr, worker: p.worker, job: jobLabel(job), status };
}

// The provider confirms a payment; only a pending one inside its window books the worker.
export async function payBooking(ctx: Ctx, paymentId: string): Promise<"paid" | "expired"> {
  const booked = await ctx.sql.begin(async (tx) => {
    const [p] = await tx<{ job_id: string; quote_id: string; fee_inr: number }[]>`
      update payments set status = 'paid', paid_at = ${ctx.now()}
      where id = ${paymentId} and status = 'pending' and expires_at > ${ctx.now()}
      returning job_id, quote_id, fee_inr`;
    if (!p) return null;
    // A pending payment always belongs to a job awaiting it; anything else is a bug, so roll back.
    if (!(await moveJob(tx, p.job_id, "awaiting_payment", "booked"))) throw new Error(`payment ${paymentId} found its job not awaiting payment`);
    const [q] = await tx<{ worker_id: string; earliest_arrival: Date | null; price: number | null }[]>`
      select worker_id, earliest_arrival, price from quotes where id = ${p.quote_id}`;
    await tx`
      insert into bookings (job_id, worker_id, quote_id, start_otp, completion_otp, eta_at)
      values (${p.job_id}, ${q!.worker_id}, ${p.quote_id}, ${otp()}, ${otp()}, ${q!.earliest_arrival})`;
    await tx`update jobs set price_inr = ${q!.price}, next_action_at = null where id = ${p.job_id}`;
    await logEvent(tx, p.job_id, "booking_made", "customer", { worker_id: q!.worker_id, fee: p.fee_inr });
    return p;
  });
  if (!booked) return "expired";
  await sendBooked(ctx, await jobById(ctx.sql, booked.job_id), booked.quote_id, booked.fee_inr);
  return "paid";
}

async function sendBooked(ctx: Ctx, job: JobRow, quoteId: string, fee: number) {
  const [b] = await ctx.sql<{ start_otp: string; name: string; phone: string; language: string; price: number | null; visit_charge: number | null; earliest_arrival: Date | null; customer_id: string }[]>`
    select b.start_otp, w.name, w.phone, w.language, q.price, q.visit_charge, q.earliest_arrival, j.customer_id
    from bookings b join workers w on w.id = b.worker_id join quotes q on q.id = b.quote_id join jobs j on j.id = b.job_id
    where b.job_id = ${job.id}`;
  const now = ctx.now();
  const lang = job.language;
  const balance = await creditBalance(ctx.sql, b!.customer_id);
  const when = b!.earliest_arrival ? whenLabel(lang, b!.earliest_arrival, now) : whenText(job, now);
  const id = await ctx.whatsapp.sendText(toWhatsApp(job.phone), whatsappText(lang, "booked_customer", {
    name: b!.name, when, price: priceText(lang, b!), fee, otp: b!.start_otp,
    credit: balance ? whatsappText(lang, "credit_balance", { credit: balance }) : "",
  }));
  await recordSent(ctx, job, "booking", id);

  const wl = b!.language;
  await ctx.whatsapp.sendText(toWhatsApp(b!.phone), whatsappText(wl, "booked_worker", {
    job: jobLabel({ ...job, language: wl }), problem: job.problem ?? "", address: job.address ?? whatsappText(wl, "none"),
    when: b!.earliest_arrival ? whenLabel(wl, b!.earliest_arrival, now) : whenText({ ...job, language: wl }, now),
    contact: job.site_contact ?? job.customer_name ?? whatsappText(wl, "none"),
    safety: job.safety_note ? whatsappText(wl, "safety_line", { note: job.safety_note }) : "",
  }));

  const others = await ctx.sql<{ phone: string; language: string }[]>`
    select w.phone, w.language from quotes q join workers w on w.id = q.worker_id
    where q.job_id = ${job.id} and q.rank is not null and q.id <> ${quoteId} order by q.call_order`;
  for (const o of others) await ctx.whatsapp.sendText(toWhatsApp(o.phone), whatsappText(o.language, "not_chosen_worker"));
}

// The payment window ran out: the job shows its quotes again and the customer may choose again.
export async function expirePayments(ctx: Ctx) {
  const expired = await ctx.sql.begin(async (tx) => {
    const rows = await tx<Released[]>`
      update payments set status = 'expired'
      where id in (select id from payments where status = 'pending' and expires_at <= ${ctx.now()} for update skip locked)
      returning job_id, customer_id, credit_inr`;
    await release(tx, rows, "timeout");
    for (const r of rows) {
      await moveJob(tx, r.job_id, "awaiting_payment", "quotes_in");
      await tx`update jobs set next_action_at = null where id = ${r.job_id}`;
    }
    return rows;
  });
  for (const r of expired) {
    const job = await jobById(ctx.sql, r.job_id);
    const id = await ctx.whatsapp.sendText(toWhatsApp(job.phone), whatsappText(job.language, "payment_expired"));
    await recordSent(ctx, job, "payment_expired", id);
  }
}
