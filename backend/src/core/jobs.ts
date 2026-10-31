import type { Sql, TransactionSql } from "postgres";
import { label, whatsappText, whenLabel } from "../messages.ts";
import { customerCard, inferUrgency, missingFields, toMaterial, toPriorities, type RequiredField } from "./card.ts";
import { toTrade, type Trade } from "./catalogue.ts";
import type { Ctx } from "./context.ts";
import { logEvent } from "./events.ts";
import { toWhatsApp } from "./phone.ts";
import type { Priority } from "./ranking.ts";
import { withFreshRef } from "./refs.ts";

export type JobStatus =
  "draft" | "confirmed" | "inviting" | "quotes_in" | "awaiting_payment" | "booked" | "done" | "cancelled" | "no_workers";

// The only moves a job may make. A job starts as draft, or confirmed when the call filled every required field.
export const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["inviting", "cancelled"],
  inviting: ["quotes_in", "no_workers", "cancelled"],
  quotes_in: ["awaiting_payment", "cancelled"],
  // Back to quotes_in when the payment window runs out, so the customer can choose again.
  awaiting_payment: ["booked", "quotes_in", "cancelled"],
  no_workers: ["inviting", "cancelled"],
  booked: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

export async function moveJob(sql: Sql | TransactionSql, jobId: string, from: JobStatus, to: JobStatus) {
  if (!TRANSITIONS[from].includes(to)) throw new Error(`job cannot move from ${from} to ${to}`);
  const rows = await sql`
    update jobs set status = ${to}, status_updated_at = now(), updated_at = now()
    where id = ${jobId} and status = ${from} returning id`;
  if (rows.length) await logEvent(sql, jobId, "status_changed", "system", { from, to });
  return rows.length === 1;
}

export type JobRow = {
  id: string;
  ref: string;
  status: JobStatus;
  language: string;
  trade: Trade;
  job_type: string | null;
  job_type_other: string | null;
  problem: string | null;
  material: "customer_has" | "worker_brings" | "not_sure" | null;
  address: string | null;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  site_contact: string | null;
  time_window_text: string | null;
  window_end: Date | null;
  priorities: Priority[];
  budget_inr: number | null;
  safety_note: string | null;
  photo_url: string | null;
  missing_fields: RequiredField[];
  pending_question: RequiredField | null;
  phone: string;
  customer_name: string | null;
};

export const jobById = async (sql: Sql | TransactionSql, id: string) =>
  (await sql<JobRow[]>`
    select j.id, j.ref, j.status, j.language, j.trade, j.job_type, j.job_type_other, j.problem, j.material, j.address,
           j.locality, j.lat, j.lng, j.site_contact, j.time_window_text, j.window_end, j.priorities, j.budget_inr,
           j.safety_note, j.photo_url, j.missing_fields, j.pending_question, c.phone, c.name as customer_name
    from jobs j join customers c on c.id = j.customer_id where j.id = ${id}`)[0]!;

export function jobLabel(job: Pick<JobRow, "language" | "job_type" | "job_type_other" | "problem">) {
  if (job.job_type && job.job_type !== "other") return label(job.language, "job_type", job.job_type);
  return job.job_type_other ?? job.problem ?? label(job.language, "job_type", "other");
}

// The caller's own words ("aaj shaam tak") read better than the end-of-day time worked out from them.
export function whenText(job: Pick<JobRow, "language" | "window_end" | "time_window_text">, now: Date) {
  if (job.time_window_text) return job.time_window_text;
  return job.window_end ? whenLabel(job.language, job.window_end, now) : whatsappText(job.language, "none");
}

async function locate(ctx: Ctx, address: string | null) {
  if (!address) return null;
  return ctx.maps.geocode(address).catch((err: Error) => {
    ctx.log(`address not located: ${err.message}`);
    return null;
  });
}

const OPEN_STATUSES: JobStatus[] = ["draft", "confirmed", "inviting", "quotes_in", "awaiting_payment", "booked"];

// Built once per intake call from Bolna's extraction; the caller's confirmed read-back is the source of truth.
export async function jobFromCall(ctx: Ctx, call: { executionId: string; phone: string; callerRef: string | null; extraction: unknown }) {
  const now = ctx.now();
  const card = customerCard(call.extraction, now);
  if (!card.trade && !card.problem && !card.address) return null;

  const place = await locate(ctx, card.address);
  const missing = missingFields(card);
  const complexity = card.complexity ?? (card.jobType && card.jobType !== "other" ? "standard" : "unclear");
  const status: JobStatus = missing.length ? "draft" : "confirmed";

  const jobId = await ctx.sql.begin(async (tx) => {
    const [customer] = await tx<{ id: string; preferred_language: string | null }[]>`
      insert into customers (phone, name, preferred_language)
      values (${call.phone}, ${card.firstName}, ${card.language ?? "hi"})
      on conflict (phone) do update
        set name = coalesce(excluded.name, customers.name),
            preferred_language = coalesce(${card.language}, customers.preferred_language)
      returning id, preferred_language`;
    const id = await withFreshRef(async (ref) => {
      const [row] = await tx<{ id: string }[]>`
        insert into jobs ${tx({
          ref,
          execution_id: call.executionId,
          caller_ref: call.callerRef,
          customer_id: customer!.id,
          channel: "call",
          language: customer!.preferred_language ?? "hi",
          trade: card.trade ?? "other",
          job_type: card.jobType,
          job_type_other: card.jobTypeOther,
          problem: card.problem,
          material: card.material,
          address: card.address,
          locality: place?.locality ?? null,
          lat: place?.lat ?? null,
          lng: place?.lng ?? null,
          site_contact: card.siteContact,
          time_window_text: card.timeWindowText,
          window_start: card.windowStart,
          window_end: card.windowEnd,
          priorities: card.priorities,
          budget_inr: card.budgetInr,
          safety_note: card.safetyNote,
          urgency: inferUrgency(card.windowEnd, now),
          complexity,
          needs_visit: complexity === "unclear",
          missing_fields: missing,
          consent: tx.json({ ai_disclosed: true }),
          status,
          next_action_at: status === "confirmed" ? new Date(now.getTime() + ctx.limits.inviteDelaySec * 1000) : null,
        })}
        on conflict (execution_id) do nothing
        returning id`;
      return row?.id ?? null;
    });
    if (!id) return null;
    await logEvent(tx, id, "extraction_done", "system", { missing });
    if (card.safetyNote) await logEvent(tx, id, "safety_note_recorded", "customer", { note: card.safetyNote });
    if (card.priorities.length) await logEvent(tx, id, "priority_question_asked", "customer", { variant: card.priorityVariant ?? "A", answer: card.priorities });
    return id;
  });
  if (!jobId) return null;

  const job = await jobById(ctx.sql, jobId);
  ctx.background(async () => {
    await sendSummary(ctx, job);
    if (job.status === "draft") await askNext(ctx, job);
  });
  return job;
}

export async function sendToCustomer(ctx: Ctx, job: Pick<JobRow, "id" | "phone">, template: string, text: string) {
  const id = await ctx.whatsapp.sendText(toWhatsApp(job.phone), text);
  await recordSent(ctx, job, template, id);
}

export async function recordSent(ctx: Ctx, job: Pick<JobRow, "id" | "phone">, template: string, messageId: string) {
  await ctx.sql`
    insert into contacts (job_id, person_kind, person_phone, channel, direction, agent_or_template, wa_message_id, status)
    values (${job.id}, 'customer', ${job.phone}, 'whatsapp', 'outbound', ${template}, ${messageId}, 'sent')`;
  await ctx.sql`update jobs set messages_sent = messages_sent || ${ctx.sql.json({ [template]: ctx.now().toISOString() })} where id = ${job.id}`;
  await logEvent(ctx.sql, job.id, "message_sent", "system", { type: template, to: "customer" });
}

// What the card actually saved, so the customer can catch a value the extraction got wrong.
async function sendSummary(ctx: Ctx, job: JobRow) {
  const none = whatsappText(job.language, "none");
  await sendToCustomer(ctx, job, "summary", whatsappText(job.language, "summary", {
    job: [jobLabel(job), job.job_type_other ? null : job.problem].filter(Boolean).join(": "),
    material: job.material ? label(job.language, "material", job.material) : none,
    address: job.address ?? none,
    when: whenText(job, ctx.now()),
    priority: job.priorities[0] ? label(job.language, "priority", job.priorities[0]) : none,
  }));
}

async function askNext(ctx: Ctx, job: Pick<JobRow, "id" | "phone" | "language" | "missing_fields">) {
  const field = job.missing_fields[0]!;
  await ctx.sql`update jobs set pending_question = ${field} where id = ${job.id}`;
  await sendToCustomer(ctx, job, `followup_${field}`, whatsappText(job.language, `ask_${field}`));
  await logEvent(ctx.sql, job.id, "followup_sent", "system", { field });
}

// A reply to the one question we asked on WhatsApp. Returns false when no question was waiting.
export async function answerFollowup(ctx: Ctx, phone: string, text: string) {
  const [job] = await ctx.sql<{ id: string; pending_question: RequiredField; problem: string | null }[]>`
    select j.id, j.pending_question, j.problem from jobs j join customers c on c.id = j.customer_id
    where c.phone = ${phone} and j.status = 'draft' and j.pending_question is not null
    order by j.created_at desc limit 1`;
  if (!job) return false;

  const field = job.pending_question;
  const priorities = field === "priority" ? toPriorities(text) : [];
  const place = field === "address" ? await locate(ctx, text) : null;
  const updates: Record<RequiredField, Record<string, unknown>> = {
    trade: { trade: toTrade(text) },
    job_type: { job_type: "other", job_type_other: text, ...(job.problem ? {} : { problem: text }) },
    problem: { problem: text },
    material: { material: toMaterial(text) },
    address: { address: text, locality: place?.locality ?? null, lat: place?.lat ?? null, lng: place?.lng ?? null },
    time_window: { time_window_text: text },
    priority: priorities.length ? { priorities } : {},
  };
  const update = updates[field];

  const fresh = await ctx.sql.begin(async (tx) => {
    if (Object.keys(update).length) await tx`update jobs set ${tx(update)}, updated_at = now() where id = ${job.id}`;
    await logEvent(tx, job.id, "followup_answered", "customer", { field, understood: Object.keys(update).length > 0 });
    const row = await jobById(tx, job.id);
    const missing = missingFields({
      trade: row.trade, jobType: row.job_type, problem: row.problem, material: row.material, address: row.address,
      timeWindowText: row.time_window_text, windowEnd: row.window_end, priorities: row.priorities,
    });
    await tx`update jobs set missing_fields = ${missing}, pending_question = null where id = ${job.id}`;
    if (!missing.length) {
      await moveJob(tx, job.id, "draft", "confirmed");
      await tx`update jobs set next_action_at = ${new Date(ctx.now().getTime() + ctx.limits.inviteDelaySec * 1000)} where id = ${job.id}`;
    }
    return { ...row, missing_fields: missing };
  });

  if (fresh.missing_fields.length) await askNext(ctx, fresh);
  else await sendToCustomer(ctx, fresh, "card_complete", whatsappText(fresh.language, "card_complete"));
  return true;
}

// Free text after the card is complete: kept on the job and passed to the workers already called.
export async function noteCustomerChange(ctx: Ctx, phone: string, text: string) {
  const [job] = await ctx.sql<{ id: string }[]>`
    select j.id from jobs j join customers c on c.id = j.customer_id
    where c.phone = ${phone} and j.status in ('confirmed', 'inviting', 'quotes_in', 'awaiting_payment')
    order by j.created_at desc limit 1`;
  if (!job) return false;
  await ctx.sql`update jobs set customer_notes = array_append(customer_notes, ${text}), updated_at = now() where id = ${job.id}`;
  const row = await jobById(ctx.sql, job.id);
  const called = await ctx.sql<{ phone: string; language: string }[]>`
    select w.phone, w.language from quotes q join workers w on w.id = q.worker_id
    where q.job_id = ${job.id} and q.call_status <> 'no_answer' order by q.call_order`;
  await logEvent(ctx.sql, job.id, "card_updated", "customer", { note: text, workers_called: called.length > 0 });
  await sendToCustomer(ctx, row, "change_noted", whatsappText(row.language, "change_noted"));
  for (const w of called) {
    await ctx.whatsapp.sendText(toWhatsApp(w.phone), whatsappText(w.language, "worker_customer_update", { job: jobLabel(row), note: text }));
  }
  return true;
}

export async function addPhoto(ctx: Ctx, phone: string, mediaId: string) {
  const [job] = await ctx.sql<{ id: string; ref: string; language: string; status: JobStatus }[]>`
    update jobs set photo_media_id = ${mediaId}, photo_url = null, updated_at = now()
    where id = (
      select j.id from jobs j join customers c on c.id = j.customer_id
      where c.phone = ${phone} and j.status = any(${OPEN_STATUSES})
      order by j.created_at desc limit 1)
    returning id, ref, language, status`;
  if (!job) return null;
  await ctx.whatsapp.sendText(toWhatsApp(phone), whatsappText(job.language, "photo_received"));
  const path = await storePhoto(ctx, job, mediaId);
  // Worker calls wait for the photo only until it arrives.
  if (job.status === "confirmed") await ctx.sql`update jobs set next_action_at = ${ctx.now()} where id = ${job.id} and status = 'confirmed'`;
  return { jobId: job.id, status: job.status, path };
}

const PHOTO_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Keeps the storage path, not a link: signed links expire. A failure leaves photo_media_id so it can be retried.
async function storePhoto(ctx: Ctx, job: { id: string; ref: string }, mediaId: string) {
  try {
    const media = await ctx.whatsapp.downloadMedia(mediaId);
    if (!media) return null;
    const path = `${job.ref}/${mediaId.replace(/[^A-Za-z0-9_-]/g, "_")}.${PHOTO_EXT[media.mimeType]}`;
    if (!(await ctx.storage.upload(path, media.bytes, media.mimeType))) return null;
    // A newer photo may have replaced this one while it uploaded.
    const rows = await ctx.sql`update jobs set photo_url = ${path} where id = ${job.id} and photo_media_id = ${mediaId} returning id`;
    return rows.length ? path : null;
  } catch (err) {
    ctx.log(`photo for job ${job.ref} not stored: ${(err as Error).message}`);
    return null;
  }
}
