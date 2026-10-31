import { workerQuote } from "./card.ts";
import type { Ctx } from "./context.ts";
import { logEvent } from "./events.ts";
import { jobFromCall } from "./jobs.ts";
import { recordWorkerCall } from "./quotes.ts";

export type CallStatus = {
  id: string;
  status: string;
  conversation_duration?: number | undefined;
  total_cost?: number | undefined;
  transcript?: string | undefined;
  extracted_data?: unknown;
  // Lookup variables Bolna echoes back; a browser test call has these without a lookup.
  caller_ref?: string | undefined;
};

const FLAG_AFTER_NO_JOB_CALLS = 2;

export async function recordCallStatus(ctx: Ctx, call: CallStatus) {
  const { sql } = ctx;
  const durationSec = call.conversation_duration === undefined ? null : Math.round(call.conversation_duration);
  const fields = {
    status: call.status,
    duration_sec: durationSec,
    cost_usd_cents: call.total_cost ?? null,
    transcript: call.transcript || null,
  };

  // Calls we placed already have a contacts row; worker quote calls also have a quotes row.
  const updated = await sql<{ direction: string }[]>`
    update contacts set ${sql(fields)} where bolna_execution_id = ${call.id} returning direction`;
  const [quote] = await sql<{ id: string; job_id: string; worker_id: string }[]>`
    select id, job_id, worker_id from quotes where bolna_execution_id = ${call.id}`;
  if (quote) {
    return recordWorkerCall(ctx, quote, {
      status: call.status,
      durationSec,
      quote: call.extracted_data ? workerQuote(call.extracted_data, ctx.now()) : null,
    });
  }
  // An inbound call has a row from its earlier statuses too, and still needs its extraction read below.
  if (updated[0]?.direction === "outbound") return;

  const [caller] = await sql<{ ref: string; line: "customer" | "worker"; phone: string }[]>`
    select ref, line, phone from caller_refs
    where execution_id = ${call.id} or (${call.caller_ref ?? null}::text is not null and ref = ${call.caller_ref ?? null})
    order by (execution_id = ${call.id}) desc nulls last limit 1`;
  if (!caller) return ctx.log(`call ${call.id} matches no lookup or outbound call; status ${call.status} kept in webhook_log only`);

  const job = caller.line === "customer" && call.extracted_data
    ? await jobFromCall(ctx, { executionId: call.id, phone: caller.phone, callerRef: caller.ref, extraction: call.extracted_data })
    : null;
  const [linked] = await sql<{ id: string }[]>`select id from jobs where execution_id = ${call.id}`;

  await sql`
    insert into contacts ${sql({
      job_id: job?.id ?? linked?.id ?? null,
      person_kind: caller.line,
      person_phone: caller.phone,
      channel: "voice",
      direction: "inbound",
      agent_or_template: `${caller.line}:inbound`,
      bolna_execution_id: call.id,
      ...fields,
    })}
    on conflict (bolna_execution_id) do update
      set status = excluded.status, duration_sec = excluded.duration_sec, cost_usd_cents = excluded.cost_usd_cents,
          transcript = excluded.transcript, job_id = coalesce(excluded.job_id, contacts.job_id)`;

  // Bolna may send call-disconnected before completed; only completed closes the call, once.
  if (call.status !== "completed") return;
  if (job ?? linked) {
    if (job) await logEvent(sql, job.id, "call_ended", "customer", { call_id: call.id, agent: "intake", minutes: (durationSec ?? 0) / 60 });
    return;
  }
  const [worker] = await sql`select 1 from workers where phone = ${caller.phone}`;
  if (caller.line === "customer" && ctx.customerLineMode === "live" && !worker) {
    await sql`
      insert into customers (phone, no_job_calls) values (${caller.phone}, 1)
      on conflict (phone) do update set no_job_calls = customers.no_job_calls + 1`;
    await sql`
      update customers set flagged_at = now()
      where phone = ${caller.phone} and flagged_at is null and no_job_calls >= ${FLAG_AFTER_NO_JOB_CALLS}`;
  }
}
