import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { BolnaClient, CallRequest } from "../../src/clients/bolna.ts";
import type { MapsClient } from "../../src/clients/maps.ts";
import type { StorageClient } from "../../src/clients/storage.ts";
import type { ListMessage, WhatsAppClient } from "../../src/clients/whatsapp.ts";
import type { Ctx } from "../../src/core/context.ts";
import { expireQuoteCalls, startDueInvites } from "../../src/core/quotes.ts";
import { migrate } from "../../src/db/migrate.ts";
import { seed } from "../../src/db/seed.ts";
import { saveWebhook } from "../../src/db/webhook-log.ts";
import { whatsappSignature } from "../../src/http/auth.ts";
import { coreServices } from "../../src/services.ts";
import { backgroundTasks, secrets } from "../helpers.ts";
import { resetDb, testSql } from "./helpers.ts";

const sql = testSql();
const NOON_IST = new Date("2026-10-27T06:30:00Z");
const CIVIL_LINES = { lat: 29.8654, lng: 77.8867 };

let clock = NOON_IST;
type Sent = { to: string; kind: "text" | "list" | "image"; text: string; list?: ListMessage };
const sent: Sent[] = [];
const calls: (CallRequest & { executionId: string })[] = [];
const uploads: string[] = [];

const whatsapp: WhatsAppClient = {
  sendText: async (to, text) => record({ to, kind: "text", text }),
  sendButtons: async (to, text) => record({ to, kind: "text", text }),
  sendList: async (to, list) => record({ to, kind: "list", text: list.body, list }),
  sendImage: async (to, _link, caption) => record({ to, kind: "image", text: caption }),
  downloadMedia: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" }),
};
async function record(s: Sent) {
  sent.push(s);
  return `wamid.out.${sent.length}.${Date.now()}`;
}
const storage: StorageClient = {
  upload: async (path) => (uploads.push(path), true),
  signedUrl: async (path) => `https://storage.test/${path}?token=t`,
};
const maps: MapsClient = { geocode: async (address) => (address.includes("Civil Lines") ? { ...CIVIL_LINES, locality: "Civil Lines" } : null) };
const bolna: BolnaClient = {
  call: async (req) => {
    const executionId = `exec-out-${calls.length + 1}-${Date.now()}`;
    calls.push({ ...req, executionId });
    return executionId;
  },
};

const background = backgroundTasks();
const ctx: Ctx = {
  sql, whatsapp, bolna, storage, maps,
  customerLine: { agentId: "agent-customer", number: "+918000000000" },
  workerLine: { agentId: "agent-worker", number: "+918000000000" },
  limits: { inviteDelaySec: 60, parallelCalls: 2, maxWorkerCalls: 6, quotesWanted: 3, callTimeoutSec: 300, extractionWaitSec: 120 },
  now: () => clock,
  log: () => {},
  background: background.run,
};

// Sanskar (seeded) plus four more carpenters, each a little further from Civil Lines.
const CARPENTERS = [
  { phone: "+919000000101", name: "Arjun", dLat: 0.005, rating: 4.2, count: 12 },
  { phone: "+919000000102", name: "Bhola", dLat: 0.01, rating: 4.4, count: 9 },
  { phone: "+919000000103", name: "Chetan", dLat: 0.02, rating: 4.8, count: 10 },
  { phone: "+919000000104", name: "Dinesh", dLat: 0.03, rating: 4.0, count: 1 },
];
const SANSKAR = "+919000000003";

let url = "";
let close = () => {};
beforeAll(async () => {
  await resetDb(sql);
  await migrate(sql);
  await seed(sql, ["+919000000001", "+919000000002", SANSKAR]);
  for (const c of CARPENTERS) {
    await sql`
      insert into workers (name, phone, trades, skills, locality, areas, lat, lng, hours_start, hours_end, language,
                           has_smartphone, online, verified, ai_call_consent_at, rating, rating_count)
      values (${c.name}, ${c.phone}, ${["carpenter"]}, ${["door_repair", "bed_repair"]}, 'Civil Lines', ${["Civil Lines"]},
              ${CIVIL_LINES.lat + c.dLat}, ${CIVIL_LINES.lng}, '08:00', '20:00', 'hi', true, true, true, now(), ${c.rating}, ${c.count})`;
  }
  const app = createApp({
    pingDb: async () => 1, version: "test", secrets, saveWebhook: saveWebhook(sql),
    services: coreServices(ctx), background: background.run, log: () => {},
  });
  const server = app.listen(0);
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(async () => {
  close();
  await sql.end();
});
beforeEach(() => {
  clock = NOON_IST;
  sent.length = 0;
  uploads.length = 0;
  ctx.limits.maxWorkerCalls = 6;
});

const bearer = { authorization: `Bearer ${secrets.BOLNA_FUNCTION_TOKEN}`, "content-type": "application/json" };
const hook = { "x-suvidha-token": secrets.BOLNA_WEBHOOK_TOKEN, "content-type": "application/json" };
let executions = 0;

async function lookup(line: "customer" | "worker", phone: string, executionId = `exec-${++executions}`): Promise<Record<string, string> & { executionId: string }> {
  const res = await fetch(`${url}/bolna/lookup/${line}?contact_number=${encodeURIComponent(phone)}&execution_id=${executionId}`, { headers: bearer });
  return { executionId, ...((await res.json()) as Record<string, string>) };
}

async function callWebhook(body: object) {
  await fetch(`${url}/bolna/webhook/call`, { method: "POST", headers: hook, body: JSON.stringify(body) });
  await background.settle();
}

const card = (overrides: Record<string, string> = {}) => ({
  trade: "carpenter", job_type: "door repair", problem: "Room door won't close; one hinge broken", material: "worker brings",
  first_name: "Rohan", address: "Civil Lines, Roorkee, near Gurudwara", time_window_latest: "2026-10-28T12:00",
  time_window: "kal dopahar 12 baje tak", priority_first: "speed", budget: "", safety_note: "Gate pe naam likhwana padta hai",
  ...overrides,
});

// An intake call ends: Bolna sends the extraction with the lookup's call id.
async function intakeCall(phone: string, overrides: Record<string, string> = {}) {
  const who = await lookup("customer", phone);
  await callWebhook({ id: who.executionId, status: "completed", conversation_duration: 150, extracted_data: { "Job Card": card(overrides) } });
  return (await sql`select * from jobs where execution_id = ${who.executionId}`)[0]!;
}

async function whatsappEvent(value: object) {
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "waba", changes: [{ field: "messages", value }] }] });
  await fetch(`${url}/whatsapp/webhook`, {
    method: "POST", body: raw,
    headers: { "content-type": "application/json", "x-hub-signature-256": whatsappSignature(secrets.WHATSAPP_APP_SECRET, raw) },
  });
  await background.settle();
}
const text = (from: string, body: string) => whatsappEvent({ messages: [{ from, id: `wamid.in.${Math.random()}`, type: "text", text: { body } }] });
const tap = (from: string, id: string) =>
  whatsappEvent({ messages: [{ from, id: `wamid.in.${Math.random()}`, type: "interactive", interactive: { type: "list_reply", list_reply: { id, title: "x" } } }] });

async function tick(at: Date) {
  clock = at;
  await startDueInvites(ctx);
  await expireQuoteCalls(ctx);
  await background.settle();
}

const job = async (id: string) => (await sql`select * from jobs where id = ${id}`)[0]!;
// The calls placed for one job, matched through the quote code each call carries.
async function callsFor(jobId: string) {
  const refs = new Set((await sql`select ref from quotes where job_id = ${jobId}`).map((q) => q.ref));
  return calls.filter((c) => refs.has(c.userData.offer_ref));
}
const callTo = async (jobId: string, phone: string) => (await callsFor(jobId)).find((c) => c.to === phone)!;
const quoteCall = async (jobId: string, phone: string, quote: Record<string, string>) =>
  callWebhook({ id: (await callTo(jobId, phone)).executionId, status: "completed", conversation_duration: 40, extracted_data: { Quote: quote } });
const unanswered = async (jobId: string, phone: string) =>
  callWebhook({ id: (await callTo(jobId, phone)).executionId, status: "no-answer", conversation_duration: 0 });
const inSeconds = (s: number) => new Date(NOON_IST.getTime() + s * 1000);

describe("a complete intake call", () => {
  const phone = "+919100000001";
  let jobId = "";

  it("builds a confirmed card from the extraction and sends the WhatsApp summary", async () => {
    const j = await intakeCall(phone);
    jobId = j.id;
    expect(j).toMatchObject({
      status: "confirmed", trade: "carpenter", job_type: "door_repair", material: "worker_brings", priorities: ["speed"],
      locality: "Civil Lines", urgency: "tomorrow", complexity: "standard", needs_visit: false, missing_fields: [],
      next_action_at: inSeconds(60),
    });
    expect(sent).toEqual([expect.objectContaining({ to: "919100000001", kind: "text" })]);
    expect(sent[0]!.text).toContain("Darwaze ki repair");
    expect(sent[0]!.text).toContain("Worker laayega");
    expect(sent[0]!.text).toContain("Jaldi aana");
    expect(sent[0]!.text).toContain("Kuch galat ho toh reply karke batayiye");
  });

  it("builds the card once even if Bolna sends the extraction again", async () => {
    const execution_id = (await sql`select execution_id from jobs where id = ${jobId}`)[0]!.execution_id;
    await callWebhook({ id: execution_id, status: "call-disconnected", extracted_data: { "Job Card": card() } });
    expect((await sql`select count(*)::int as n from jobs where execution_id = ${execution_id}`)[0]!.n).toBe(1);
  });

  it("starts worker calls one minute later, two at a time, nearest skilled first, with the job card on WhatsApp", async () => {
    await tick(inSeconds(59));
    expect(await callsFor(jobId)).toEqual([]);
    await tick(inSeconds(61));
    expect((await job(jobId)).status).toBe("inviting");
    const placed = await callsFor(jobId);
    expect(placed.map((c) => c.to)).toEqual([SANSKAR, "+919000000101"]);
    expect(placed[0]).toMatchObject({ agentId: "agent-worker", from: "+918000000000", userData: expect.objectContaining({ call_type: "quote", job_price: "" }) });

    const cards = sent.filter((s) => s.to === "919000000003" || s.to === "919000000101");
    expect(cards).toHaveLength(2);
    // Workers see the area, never the address, the customer's number or the budget, before they're booked.
    for (const t of [...cards.map((c) => c.text), ...placed.map((c) => JSON.stringify(c.userData))]) {
      expect(t).not.toContain("Gurudwara");
      expect(t).not.toContain("9100000001");
    }
    expect(cards[0]!.text).toContain("Civil Lines");
  });

  it("replaces a decline or a missed call with the next worker and stops once 3 quotes are in", async () => {
    await quoteCall(jobId, SANSKAR, { available: "yes", price: "350", material_included: "yes", earliest_arrival: "2026-10-27T17:30" });
    expect((await callsFor(jobId)).map((c) => c.to)).toEqual([SANSKAR, "+919000000101", "+919000000102"]);
    await unanswered(jobId, "+919000000101");
    await quoteCall(jobId, "+919000000102", { available: "no", decline_reason: "bahut door hai" });
    expect(await callsFor(jobId)).toHaveLength(5);
    await quoteCall(jobId, "+919000000103", { available: "yes", price_min: "300", price_max: "400", material_included: "no", earliest_arrival: "2026-10-27T18:00" });
    expect((await job(jobId)).status).toBe("inviting");
    await quoteCall(jobId, "+919000000104", { available: "yes", price_type: "only after visit", visit_charge: "100", earliest_arrival: "2026-10-27T19:00" });

    expect((await job(jobId)).status).toBe("quotes_in");
    const quotes = await sql`select w.name, q.call_status, q.rank, q.rank_group, q.rank_reason from quotes q join workers w on w.id = q.worker_id where q.job_id = ${jobId} order by q.call_order`;
    expect(quotes.map((q) => [q.name, q.call_status, q.rank, q.rank_group])).toEqual([
      ["Sanskar", "answered", 1, "ranked"],
      ["Arjun", "no_answer", null, null],
      ["Bhola", "answered", null, null],
      ["Chetan", "answered", 2, "ranked"],
      ["Dinesh", "answered", 3, "visit"],
    ]);
    expect(quotes[0]!.rank_reason).toBe("Sabse jaldi aa sakte hain: aaj 5:30 pm");
  });

  it("sends the customer a tap-to-book shortlist", async () => {
    const [shortlist] = (await sql`select count(*)::int as n from contacts where job_id = ${jobId} and agent_or_template = 'shortlist'`);
    expect(shortlist!.n).toBe(1);
  });

  it("books the tapped worker once; the worker gets the address and the others are told", async () => {
    const ref = (await sql`select q.ref from quotes q join workers w on w.id = q.worker_id where q.job_id = ${jobId} and w.name = 'Sanskar'`)[0]!.ref;
    await tap("919100000099", `book:${ref}`);
    expect((await job(jobId)).status).toBe("quotes_in");

    await tap("919100000001", `book:${ref}`);
    expect(await job(jobId)).toMatchObject({ status: "booked", price_inr: 350 });
    const [booking] = await sql`select start_otp, eta_at from bookings where job_id = ${jobId}`;
    expect(booking!.eta_at).toEqual(new Date("2026-10-27T12:00:00Z"));
    expect(sent.find((s) => s.to === "919100000001")!.text).toContain(booking!.start_otp);
    expect(sent.find((s) => s.to === "919000000003")!.text).toContain("Civil Lines, Roorkee, near Gurudwara");
    expect(sent.filter((s) => s.text.includes("kisi aur worker")).map((s) => s.to).sort()).toEqual(["919000000103", "919000000104"]);

    await tap("919100000001", `book:${ref}`);
    expect((await sql`select count(*)::int as n from bookings where job_id = ${jobId}`)[0]!.n).toBe(1);
  });

  it("lets the customer and the booked worker reach each other through the agent", async () => {
    const customer = await lookup("customer", phone);
    expect(customer).toMatchObject({ caller_type: "repeat", transfer_number: SANSKAR });
    expect(customer.open_job).toContain("Sanskar");
    // While testing on one number, the worker reaches the customer line too.
    expect(await lookup("customer", SANSKAR)).toMatchObject({ caller_type: "worker", name: "Sanskar", transfer_number: phone });
  });

  it("treats a worker without a booking who calls the customer line as a customer", async () => {
    const nishant = "+919000000001";
    expect(await lookup("customer", nishant)).toMatchObject({ caller_type: "new", transfer_number: "" });
    expect((await intakeCall(nishant, { trade: "plumber", job_type: "tap repair" })).status).toBe("confirmed");
  });
});

describe("the shortlist message", () => {
  it("ranks, labels and lists each quote with a tap to book", async () => {
    const j = await intakeCall("+919100000007");
    await tick(inSeconds(61));
    await quoteCall(j.id, SANSKAR, { available: "yes", price: "350", material_included: "yes", earliest_arrival: "2026-10-27T17:30" });
    await quoteCall(j.id, "+919000000101", { available: "yes", price_min: "300", price_max: "400", material_included: "no", earliest_arrival: "2026-10-27T18:00" });
    await quoteCall(j.id, "+919000000102", { available: "yes", price_type: "only after visit", visit_charge: "100" });

    expect((await job(j.id)).status).toBe("quotes_in");
    const shortlist = sent.find((s) => s.kind === "list" && s.to === "919100000007")!;
    expect(shortlist.to).toBe("919100000007");
    expect(shortlist.list!.button).toBe("Worker chuniye");
    expect(shortlist.list!.sections.map((s) => [s.title, s.rows.map((r) => r.title)])).toEqual([
      ["Rates", ["1. Sanskar", "2. Arjun"]],
      ["Visit ke baad rate", ["3. Bhola"]],
    ]);
    expect(shortlist.list!.sections[0]!.rows[0]!.id).toMatch(/^book:[A-Z2-9]{4}$/);
    expect(shortlist.text).toContain("₹350");
    expect(shortlist.text).toContain("₹300–400");
    expect(shortlist.text).toContain("saaman alag se");
    expect(shortlist.text).toContain("visit charge ₹100");
    expect(shortlist.text).toContain("Photo nahi mili");
  });
});

describe("a call that left fields empty", () => {
  const phone = "+919100000002";

  it("stays a draft and asks one question at a time on WhatsApp until the card is complete", async () => {
    const j = await intakeCall(phone, { time_window: "", time_window_latest: "", priority_first: "" });
    expect(j).toMatchObject({ status: "draft", missing_fields: ["time_window", "priority"], urgency: "flexible" });
    expect(sent.map((s) => s.text.slice(0, 16))).toEqual(["*Suvidha: aapka ", "Kab tak ho jaana"]);
    expect((await job(j.id)).pending_question).toBe("time_window");

    await text("919100000002", "kal subah tak");
    expect(await job(j.id)).toMatchObject({ time_window_text: "kal subah tak", pending_question: "priority", status: "draft" });

    await text("919100000002", "pata nahi");
    expect((await job(j.id)).pending_question).toBe("priority");

    await text("919100000002", "jo sabse jaldi aa sake");
    expect(await job(j.id)).toMatchObject({ status: "confirmed", priorities: ["speed"], missing_fields: [], pending_question: null });
    expect(sent.at(-1)!.text).toContain("Shukriya");
  });
});

describe("photos and changes", () => {
  const phone = "+919100000003";
  let jobId = "";

  it("stores the photo, starts worker calls at once, and sends it with the job card", async () => {
    jobId = (await intakeCall(phone)).id;
    await whatsappEvent({ messages: [{ from: "919100000003", id: "wamid.photo.1", type: "image", image: { id: "media-1", mime_type: "image/jpeg" } }] });
    const j = await job(jobId);
    expect(j.photo_url).toBe(`${j.ref}/media-1.jpg`);
    await tick(inSeconds(1));
    expect((await job(jobId)).status).toBe("inviting");
    expect(sent.filter((s) => s.kind === "image").map((s) => s.to)).toEqual(["919000000003", "919000000101"]);
  });

  it("notes a change sent after the call and passes it to the workers already called", async () => {
    sent.length = 0;
    await text("919100000003", "Darwaza bedroom ka nahi, bathroom ka hai");
    expect((await job(jobId)).customer_notes).toEqual(["Darwaza bedroom ka nahi, bathroom ka hai"]);
    expect(sent.find((s) => s.to === "919100000003")!.text).toContain("badlaav note kar liya");
    expect(sent.filter((s) => s.text.includes("bathroom ka hai")).map((s) => s.to)).toEqual(["919000000003", "919000000101"]);
  });
});

describe("when nobody quotes", () => {
  it("stops after the call limit, counting missed calls, and sends the honest apology", async () => {
    ctx.limits.maxWorkerCalls = 3;
    const j = await intakeCall("+919100000004");
    await tick(inSeconds(61));
    for (let i = 0; i < 3; i++) await unanswered(j.id, (await callsFor(j.id))[i]!.to);
    expect(await callsFor(j.id)).toHaveLength(3);
    expect((await job(j.id)).status).toBe("no_workers");
    expect(sent.filter((s) => s.to === "919100000004").at(-1)!.text).toContain("koi worker uplabdh nahi");
  });

  it("gives up on a call that never reports an end", async () => {
    ctx.limits.maxWorkerCalls = 2;
    const j = await intakeCall("+919100000005");
    await tick(inSeconds(61));
    await tick(inSeconds(61 + 301));
    expect((await sql`select call_status from quotes where job_id = ${j.id}`).map((q) => q.call_status)).toEqual(["no_answer", "no_answer"]);
    expect((await job(j.id)).status).toBe("no_workers");
  });
});

describe("browser test calls", () => {
  it("build the card from the caller code Bolna echoes back, without a lookup on that call", async () => {
    const who = await lookup("customer", "+919100000006");
    await callWebhook({
      id: "browser-call-1", status: "completed", conversation_duration: 90, extracted_data: { "Job Card": card() },
      context_details: { recipient_data: { caller_ref: who.caller_ref } },
    });
    expect((await sql`select status from jobs where execution_id = 'browser-call-1'`)[0]).toEqual({ status: "confirmed" });
  });
});

describe("caller limits", () => {
  it("rejects a fourth call on the same day", async () => {
    for (let i = 0; i < 3; i++) expect(await lookup("customer", "+919100000011")).toHaveProperty("caller_ref");
    const { executionId: _, ...fourth } = await lookup("customer", "+919100000011");
    expect(fourth).toEqual({});
  });

  it("flags a number after two calls that made no job", async () => {
    for (const id of ["exec-prank-1", "exec-prank-2"]) {
      await lookup("customer", "+919100000012", id);
      await callWebhook({ id, status: "completed", conversation_duration: 20, extracted_data: { General: { "Call Summary": "asked for a song" } } });
    }
    const { executionId: _, ...next } = await lookup("customer", "+919100000012");
    expect(next).toEqual({});
  });
});

describe("worker line", () => {
  it("registers a new worker only with consent, once", async () => {
    const who = await lookup("worker", "+919100000020");
    expect(who.caller_type).toBe("new_worker");
    const join = {
      caller_ref: who.caller_ref, name: "Mohit", trades: "electrician, carpenter", skills: "fan fitting, door repair",
      areas: "Ganeshpur and Civil Lines", working_hours: "9 se 7", has_smartphone: "yes", language: "hi", consent_ai_calls: "no",
    };
    const fn = async (body: object) => (await fetch(`${url}/bolna/fn/register_worker`, { method: "POST", headers: bearer, body: JSON.stringify(body) })).json();
    expect(await fn(join)).toMatchObject({ ok: false });
    expect(await fn({ ...join, consent_ai_calls: "yes" })).toEqual({ ok: true, next_step_text: expect.stringContaining("ID check") });
    expect(await fn({ ...join, consent_ai_calls: "yes" })).toMatchObject({ next_step_text: expect.stringContaining("पहले से") });
    const [w] = await sql`select trades, verified, skills from workers where phone = '+919100000020'`;
    expect(w).toMatchObject({ trades: ["electrician", "carpenter"], verified: false });
    expect(w!.skills).toEqual(expect.arrayContaining(["fan", "door_repair"]));
  });
});
