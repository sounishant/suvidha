import { randomInt } from "node:crypto";
import type { Media } from "../clients/whatsapp.ts";
import { whatsappText } from "../messages.ts";
import { recordCallStatus } from "./calls.ts";
import type { Ctx } from "./context.ts";
import { photoForCustomer } from "./customer-app.ts";
import { OPEN_STATUSES } from "./jobs.ts";
import { lookupCustomer } from "./lookup.ts";
import { SANDBOX_PREFIX, toWhatsApp } from "./phone.ts";
import { istDayStart } from "./time.ts";
import { handleWhatsApp } from "./whatsapp-events.ts";

// Every try is a real Bolna call from the website, so the day's total is capped.
export const DEMO_TRIES_PER_DAY = 50;

export type DemoStart = { ok: true; phone: string; session: object } | { ok: false; reason: "closed" | "limit" };

export async function startDemo(ctx: Ctx): Promise<DemoStart> {
  if (!ctx.customerLine) return { ok: false, reason: "closed" };
  const [today] = await ctx.sql<{ tries: number }[]>`
    select count(*)::int as tries from caller_refs
    where line = 'customer' and phone like ${`${SANDBOX_PREFIX}%`} and created_at >= ${istDayStart(ctx.now())}`;
  if (today!.tries >= DEMO_TRIES_PER_DAY) return { ok: false, reason: "limit" };

  // The first digit after +9100 is never 0, so a visitor never shares a number with a demo worker.
  const phone = `${SANDBOX_PREFIX}${randomInt(1, 10)}${String(randomInt(0, 10_000_000)).padStart(7, "0")}`;
  const userData = (await lookupCustomer(ctx, { phone, executionId: null })) as Record<string, string>;
  const session = await ctx.bolna.webSession(ctx.customerLine.agentId, userData);
  await ctx.sql`update caller_refs set execution_id = ${session.run_id} where ref = ${userData.caller_ref!}`;
  return { ok: true, phone, session };
}

export async function demoFeed(ctx: Ctx, phone: string, after: number) {
  const { sql } = ctx;
  const messages = await sql<{ id: number; kind: string; body: unknown; at: Date }[]>`
    select id, kind, body, created_at as at from demo_messages where phone = ${phone} and id > ${after} order by id`;
  const [job] = await sql<{ id: string; ref: string; status: string; trade: string; problem: string | null; locality: string | null; time_window_text: string | null; priorities: string[]; next_action_at: Date | null }[]>`
    select j.id, j.ref, j.status, j.trade, j.problem, j.locality, j.time_window_text, j.priorities, j.next_action_at
    from jobs j join customers c on c.id = j.customer_id
    where c.phone = ${phone} order by j.created_at desc limit 1`;
  if (!job) return { messages: [...messages], job: null, quotes: [] };
  const { id, ...card } = job;
  const quotes = await sql<{ name: string; rating: number | null; status: string; price: number | null; visit_charge: number | null; arrival: Date | null }[]>`
    select w.name, w.rating::float as rating, q.call_status as status, q.price, q.visit_charge, q.earliest_arrival as arrival
    from quotes q join workers w on w.id = q.worker_id where q.job_id = ${id} order by q.call_order`;
  return { messages: [...messages], job: card, quotes: [...quotes] };
}

export type DemoReply = { text: string } | { choice: string; label: string };

// The website's phone answers the way WhatsApp would, through the same handler.
export async function demoReply(ctx: Ctx, phone: string, reply: DemoReply) {
  const from = phone.slice(1);
  const shown = "choice" in reply ? reply.label : reply.text;
  await ctx.sql`insert into demo_messages (phone, kind, body) values (${phone}, 'sent', ${ctx.sql.json({ text: shown })})`;
  const message = "choice" in reply
    ? { from, type: "interactive", interactive: { button_reply: { id: reply.choice } } }
    : { from, type: "text", text: { body: reply.text } };
  await handleWhatsApp(ctx, { entry: [{ changes: [{ value: { messages: [message] } }] }] });
}

// What a demo worker charges: a typical Roorkee rate for the trade, a little lower or higher per worker.
// A photo from the website's phone takes the web app's path, then reads back as WhatsApp would.
export async function demoPhoto(ctx: Ctx, phone: string, media: Media) {
  const [job] = await ctx.sql<{ ref: string; language: string }[]>`
    select j.ref, j.language from jobs j join customers c on c.id = j.customer_id
    where c.phone = ${phone} and j.status = any(${OPEN_STATUSES}) order by j.created_at desc limit 1`;
  if (!job) return "not_open" as const;
  const result = await photoForCustomer(ctx, phone, job.ref, media);
  if (result === "saved") {
    await ctx.sql`insert into demo_messages (phone, kind, body) values (${phone}, 'sent', ${ctx.sql.json({ text: "Photo", photo: true })})`;
    await ctx.whatsapp.sendText(toWhatsApp(phone), whatsappText(job.language, "photo_received"));
  }
  return result;
}

const BASE_PRICE: Record<string, number> = { plumber: 350, electrician: 300, carpenter: 450 };
const MARKUP = [0.9, 1, 1.2];
const ARRIVAL_MINUTES = [40, 25, 90];

// Demo workers answer a few seconds apart, fed in as a finished call's extraction.
// A call's timeout was set from ctx.now() when it was placed, so it dates the call on the same clock.
export async function answerSandboxCalls(ctx: Ctx) {
  const due = await ctx.sql<{ id: string; call_order: number; trade: string }[]>`
    select q.bolna_execution_id as id, q.call_order, j.trade
    from quotes q join jobs j on j.id = q.job_id
    where q.call_status = 'calling' and q.bolna_execution_id like 'sandbox-%'
      and q.next_action_at <= ${ctx.now()}::timestamptz + make_interval(secs => ${ctx.limits.callTimeoutSec} - 6 - 8 * q.call_order)`;
  for (const q of due) {
    const i = (q.call_order - 1) % 3;
    await recordCallStatus(ctx, {
      id: q.id,
      status: "completed",
      conversation_duration: 40,
      extracted_data: {
        available: "yes",
        price: String(Math.round(((BASE_PRICE[q.trade] ?? 400) * MARKUP[i]!) / 10) * 10),
        arrival_in_minutes: String(ARRIVAL_MINUTES[i]),
        material_included: "no",
      },
    });
  }
}
