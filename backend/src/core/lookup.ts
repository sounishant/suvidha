import { say, tradeName } from "../messages.ts";
import type { Ctx } from "./context.ts";
import { withFreshRef } from "./refs.ts";
import { istClock, istDayStart } from "./time.ts";

type Line = "customer" | "worker";
type Caller = { phone: string; executionId: string | null };

// An empty object tells Bolna to reject the call before it is answered (when blocking is switched on).
const REJECT = {};
const MAX_CALLS_PER_DAY = 3;

async function issueCallerRef(ctx: Ctx, line: Line, { phone, executionId }: Caller) {
  // Bolna may retry a lookup; the same call keeps the same code.
  return withFreshRef(async (ref) => {
    const [row] = await ctx.sql<{ ref: string }[]>`
      insert into caller_refs (ref, line, phone, execution_id)
      values (${ref}, ${line}, ${phone}, ${executionId})
      on conflict (execution_id) do update set execution_id = excluded.execution_id
      returning ref`;
    return row!.ref;
  });
}

type Worker = { id: string; name: string; language: string; blocked: boolean };

const workerByPhone = async (ctx: Ctx, phone: string) =>
  (await ctx.sql<Worker[]>`select id, name, language, blocked from workers where phone = ${phone}`)[0];

// The worker's booked job, so the agent can connect him to the customer without either seeing the other's number.
async function workerBooking(ctx: Ctx, worker: Worker) {
  const [b] = await ctx.sql<{ problem: string | null; locality: string | null; customer_phone: string }[]>`
    select j.problem, j.locality, c.phone as customer_phone
    from bookings b join jobs j on j.id = b.job_id join customers c on c.id = j.customer_id
    where b.worker_id = ${worker.id} and j.status = 'booked'
    order by b.confirmed_at desc limit 1`;
  return b
    ? { line: say(worker.language, "worker_booked_job", { name: worker.name, problem: b.problem ?? "", locality: b.locality ?? "" }), transfer: b.customer_phone }
    : { line: "", transfer: "" };
}

export async function lookupCustomer(ctx: Ctx, caller: Caller) {
  const { sql } = ctx;
  const live = ctx.customerLineMode === "live";
  // While testing on one number, a worker with a booked job reaches it here; anyone else is a customer, workers included.
  const worker = live ? await workerByPhone(ctx, caller.phone) : undefined;
  if (worker?.blocked) return REJECT;
  const booking = worker ? await workerBooking(ctx, worker) : null;
  if (worker && booking?.transfer) {
    return {
      call_type: "inbound", caller_ref: await issueCallerRef(ctx, "customer", caller), caller_type: "worker",
      name: worker.name, last_address: "", open_job: booking.line, transfer_number: booking.transfer,
    };
  }

  const [customer] = await sql<{ id: string; name: string | null; last_address: string | null; preferred_language: string | null; blocked: boolean; flagged_at: Date | null; repeat: boolean }[]>`
    select c.id, c.name, c.last_address, c.preferred_language, c.blocked, c.flagged_at,
           exists (select 1 from jobs j where j.customer_id = c.id and j.status in ('booked', 'done')) as repeat
    from customers c where c.phone = ${caller.phone}`;
  if (customer?.blocked || (live && customer?.flagged_at)) return REJECT;

  if (live) {
    const [today] = await sql<{ calls: number }[]>`
      select count(*)::int as calls from caller_refs
      where line = 'customer' and phone = ${caller.phone} and created_at >= ${istDayStart(ctx.now())}
        and execution_id is distinct from ${caller.executionId}`;
    if (today!.calls >= MAX_CALLS_PER_DAY) return REJECT;
  }

  const callerRef = await issueCallerRef(ctx, "customer", caller);
  let openJob = "";
  let transfer = "";
  if (customer) {
    const lang = customer.preferred_language;
    const [job] = await sql<{ status: string; trade: string; worker: string | null; worker_phone: string | null; eta_at: Date | null }[]>`
      select j.status, j.trade, w.name as worker, w.phone as worker_phone, b.eta_at
      from jobs j
      left join bookings b on b.job_id = j.id
      left join workers w on w.id = b.worker_id
      where j.customer_id = ${customer.id} and j.status in ('draft', 'confirmed', 'inviting', 'quotes_in', 'awaiting_payment', 'booked')
      order by j.created_at desc limit 1`;
    if (job) {
      const trade = tradeName(lang, job.trade);
      openJob =
        job.status === "draft" ? say(lang, "open_job_draft", { trade })
        : job.status === "quotes_in" ? say(lang, "open_job_quotes")
        : job.status === "awaiting_payment" ? say(lang, "open_job_payment")
        : job.status === "booked" && job.eta_at ? say(lang, "open_job_booked", { trade, worker: job.worker!, eta: istClock(job.eta_at) })
        : job.status === "booked" ? say(lang, "open_job_booked_no_eta", { trade, worker: job.worker! })
        : say(lang, "open_job_inviting", { trade });
      transfer = job.worker_phone ?? "";
    }
  }

  return {
    call_type: "inbound",
    caller_ref: callerRef,
    caller_type: customer?.repeat ? "repeat" : "new",
    name: customer?.name ?? "",
    last_address: customer?.last_address ?? "",
    open_job: openJob,
    transfer_number: transfer,
  };
}

export async function lookupWorker(ctx: Ctx, caller: Caller) {
  const worker = await workerByPhone(ctx, caller.phone);
  if (worker?.blocked) return REJECT;
  const booking = worker ? await workerBooking(ctx, worker) : { line: "", transfer: "" };
  return {
    call_type: "inbound",
    caller_ref: await issueCallerRef(ctx, "worker", caller),
    caller_type: worker ? "worker" : "new_worker",
    name: worker?.name ?? "",
    open_job: booking.line,
    transfer_number: booking.transfer,
  };
}
