import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { BolnaClient, CallRequest } from "../../src/clients/bolna.ts";
import type { MapsClient } from "../../src/clients/maps.ts";
import { sandboxBolna, sandboxWhatsApp } from "../../src/clients/sandbox.ts";
import type { StorageClient } from "../../src/clients/storage.ts";
import type { ListMessage, WhatsAppClient } from "../../src/clients/whatsapp.ts";
import type { Ctx } from "../../src/core/context.ts";
import { expirePayments } from "../../src/core/bookings.ts";
import { suvidhaCancels } from "../../src/core/cancellations.ts";
import { answerSandboxCalls, demoFeed, demoReply, startDemo } from "../../src/core/demo.ts";
import { expireQuoteCalls, startDueInvites } from "../../src/core/quotes.ts";
import { migrate } from "../../src/db/migrate.ts";
import { seed } from "../../src/db/seed.ts";
import { saveWebhook } from "../../src/db/webhook-log.ts";
import { whatsappSignature } from "../../src/http/auth.ts";
import { coreServices } from "../../src/services.ts";
import { fakePayments } from "../../src/clients/payments.ts";
import { backgroundTasks, secrets } from "../helpers.ts";
import { resetDb, testSql } from "./helpers.ts";

const sql = testSql();
const NOON_IST = new Date("2026-10-27T06:30:00Z");
const CIVIL_LINES = { lat: 29.8654, lng: 77.8867 };

let clock = NOON_IST;
type Sent = { to: string; kind: "text" | "list" | "image"; text: string; list?: ListMessage; buttons?: string[] };
const sent: Sent[] = [];
const calls: (CallRequest & { executionId: string })[] = [];
const uploads: string[] = [];

const whatsapp: WhatsAppClient = {
  sendText: async (to, text) => record({ to, kind: "text", text }),
  sendButtons: async (to, text, buttons) => record({ to, kind: "text", text, buttons: buttons.map((b) => b.id) }),
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
  webSession: async () => ({ run_id: `web-${calls.length}-${Date.now()}` }),
};

const background = backgroundTasks();
const ctx: Ctx = {
  sql, whatsapp: sandboxWhatsApp(whatsapp, sql), bolna: sandboxBolna(bolna), storage, maps, payments: fakePayments("https://pay.test", () => {}),
  customerLine: { agentId: "agent-customer", number: "+918000000000" },
  workerLine: { agentId: "agent-worker", number: "+918000000000" },
  customerLineMode: "live",
  limits: { inviteDelaySec: 60, parallelCalls: 2, maxWorkerCalls: 6, quotesWanted: 3, callTimeoutSec: 300, extractionWaitSec: 120, paymentWindowSec: 300 },
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
  ctx.customerLineMode = "live";
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
  // Bolna's real order: earlier statuses carry no extraction; it comes with completed.
  for (const status of ["ringing", "in-progress", "call-disconnected"]) await callWebhook({ id: who.executionId, status, conversation_duration: 0 });
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
  await expirePayments(ctx);
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
    const j = await intakeCall(phone, { area: "Civil Lines, Roorkee" });
    jobId = j.id;
    expect(j).toMatchObject({
      status: "confirmed", trade: "carpenter", job_type: "door_repair", material: "worker_brings", priorities: ["speed"],
      locality: "Civil Lines, Roorkee", urgency: "tomorrow", complexity: "standard", needs_visit: false, missing_fields: [],
      next_action_at: inSeconds(60),
    });
    expect(sent).toEqual([expect.objectContaining({ to: "919100000001", kind: "text" })]);
    expect(sent[0]!.text).toContain("Darwaze ki repair");
    expect(sent[0]!.text).toContain("Worker laayega");
    expect(sent[0]!.text).toContain("Jaldi aana");
    expect(sent[0]!.text).toContain("Koi jaankari galat ho to isi message par reply kijiye");
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
    expect(cards[0]!.text).toContain("Jagah: Civil Lines, Roorkee");
    expect(placed[0]!.userData).toMatchObject({ area: "Civil Lines, Roorkee" });
  });

  it("replaces a decline or a missed call with the next worker and stops once 3 quotes are in", async () => {
    await quoteCall(jobId, SANSKAR, { available: "yes", price: "350", material_included: "yes", earliest_arrival: "2026-10-27T17:30" });
    expect((await callsFor(jobId)).map((c) => c.to)).toEqual([SANSKAR, "+919000000101", "+919000000102"]);
    await unanswered(jobId, "+919000000101");
    await quoteCall(jobId, "+919000000102", { available: "no", decline_reason: "bahut door hai" });
    expect(await callsFor(jobId)).toHaveLength(5);
    await quoteCall(jobId, "+919000000103", { available: "yes", price: "380", material_included: "no", earliest_arrival: "2026-10-27T18:00" });
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
    expect(quotes[0]!.rank_reason).toBe("Sabse jaldi pahunchenge: aaj 5:30 pm");
  });

  it("sends the customer a tap-to-book shortlist", async () => {
    const [shortlist] = (await sql`select count(*)::int as n from contacts where job_id = ${jobId} and agent_or_template = 'shortlist'`);
    expect(shortlist!.n).toBe(1);
  });

  it("asks for the booking fee when the customer taps a worker, and books once it is paid", async () => {
    const ref = (await sql`select q.ref from quotes q join workers w on w.id = q.worker_id where q.job_id = ${jobId} and w.name = 'Sanskar'`)[0]!.ref;
    await tap("919100000099", `book:${ref}`);
    expect((await job(jobId)).status).toBe("quotes_in");

    await tap("919100000001", `book:${ref}`);
    expect((await job(jobId)).status).toBe("awaiting_payment");
    const request = sent.filter((s) => s.to === "919100000001").at(-1)!.text;
    const link = request.match(/https:\/\/pay\.test\/pay\/(\S+)/)!;
    expect(request).toContain("Booking fee: ₹29");
    expect(request).toContain("₹350");
    expect(await sql`select fee_inr, credit_inr, amount_inr, status from payments where job_id = ${jobId}`).toEqual([
      { fee_inr: 29, credit_inr: 0, amount_inr: 29, status: "pending" },
    ]);

    expect(await (await fetch(`${url}/pay/${link[1]}`)).text()).toContain("Pay ₹29");
    expect(await (await fetch(`${url}/pay/${link[1]}`, { method: "POST" })).text()).toContain("Paid");
    await background.settle();
    expect(await job(jobId)).toMatchObject({ status: "booked", price_inr: 350 });
    const [booking] = await sql`select start_otp, eta_at from bookings where job_id = ${jobId}`;
    expect(booking!.eta_at).toEqual(new Date("2026-10-27T12:00:00Z"));
    expect(sent.filter((s) => s.to === "919100000001").at(-1)!.text).toContain(booking!.start_otp);
    expect(sent.find((s) => s.to === "919000000003" && s.text.includes("Kaam confirm ho gaya"))!.text).toContain("Civil Lines, Roorkee, near Gurudwara");
    expect(sent.filter((s) => s.text.includes("kisi aur worker")).map((s) => s.to).sort()).toEqual(["919000000103", "919000000104"]);

    expect(await (await fetch(`${url}/pay/${link[1]}`, { method: "POST" })).text()).toContain("Already paid");
    await tap("919100000001", `book:${ref}`);
    expect((await sql`select count(*)::int as n from bookings where job_id = ${jobId}`)[0]!.n).toBe(1);
  });

  it("lets the customer and the booked worker reach each other through the agent", async () => {
    const customer = await lookup("customer", phone);
    expect(customer).toMatchObject({ caller_type: "repeat", transfer_number: SANSKAR });
    expect(customer.open_job).toContain("Sanskar");
    // While testing on one number, the worker reaches the customer line too.
    expect(await lookup("customer", SANSKAR)).toMatchObject({ caller_type: "worker", name: "Sanskar", transfer_number: phone });
    ctx.customerLineMode = "test";
    expect(await lookup("customer", SANSKAR)).toMatchObject({ caller_type: "new", transfer_number: "" });
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
    await quoteCall(j.id, "+919000000101", { available: "yes", price: "380", material_included: "no", earliest_arrival: "2026-10-27T18:00" });
    await quoteCall(j.id, "+919000000102", { available: "yes", price_type: "only after visit", visit_charge: "100" });

    expect((await job(j.id)).status).toBe("quotes_in");
    const shortlist = sent.find((s) => s.kind === "list" && s.to === "919100000007")!;
    expect(shortlist.to).toBe("919100000007");
    expect(shortlist.list!.button).toBe("Worker chuniye");
    expect(shortlist.list!.sections.map((s) => [s.title, s.rows.map((r) => r.title)])).toEqual([
      ["Rates", ["1. Sanskar", "2. Arjun"]],
      ["Visit ke baad rate", ["3. Bhola"]],
      ["Aur", ["Request cancel karein"]],
    ]);
    expect(shortlist.list!.sections[0]!.rows[0]!.id).toMatch(/^book:[A-Z2-9]{4}$/);
    expect(shortlist.text).toContain("₹350 + ₹29 fee");
    expect(shortlist.text).toContain("₹380 + ₹29 fee");
    expect(shortlist.text).toContain("saaman alag se");
    expect(shortlist.text).toContain("Visit charge ₹100 + ₹29 fee");
    expect(shortlist.text).toContain("Photo nahi mili");
  });
});

async function quotedJob(phone: string) {
  ctx.limits.maxWorkerCalls = 4;
  const j = await intakeCall(phone);
  await tick(inSeconds(61));
  await quoteCall(j.id, SANSKAR, { available: "yes", price: "350", earliest_arrival: "2026-10-27T17:30" });
  await quoteCall(j.id, "+919000000101", { available: "yes", price: "2400", earliest_arrival: "2026-10-27T18:00" });
  await unanswered(j.id, "+919000000102");
  await unanswered(j.id, "+919000000103");
  expect((await job(j.id)).status).toBe("quotes_in");
  const refs = await sql`select w.name, q.ref from quotes q join workers w on w.id = q.worker_id where q.job_id = ${j.id}`;
  return { id: j.id, ref: (name: string) => refs.find((r) => r.name === name)!.ref as string };
}

describe("the booking fee", () => {
  it("gives the customer 5 minutes to pay, then shows the quotes again", async () => {
    const j = await quotedJob("+919100000021");
    await tap("919100000021", `book:${j.ref("Sanskar")}`);
    await tick(inSeconds(61 + 299));
    expect((await job(j.id)).status).toBe("awaiting_payment");
    await tick(inSeconds(61 + 301));
    expect((await job(j.id)).status).toBe("quotes_in");
    expect(sent.filter((s) => s.to === "919100000021").at(-1)!.text).toContain("time khatam");
    const [p] = await sql`select id, status from payments where job_id = ${j.id}`;
    expect(p!.status).toBe("expired");
    expect(await (await fetch(`${url}/pay/${p!.id}`, { method: "POST" })).text()).toContain("expired");
    expect((await job(j.id)).status).toBe("quotes_in");
  });

  it("replaces the waiting payment when the customer chooses someone else, with the fee for that price", async () => {
    const j = await quotedJob("+919100000022");
    await tap("919100000022", `book:${j.ref("Sanskar")}`);
    await tap("919100000022", `book:${j.ref("Arjun")}`);
    expect(await sql`select fee_inr, status from payments where job_id = ${j.id} order by created_at`).toEqual([
      { fee_inr: 29, status: "expired" }, { fee_inr: 99, status: "pending" },
    ]);
    expect((await job(j.id)).status).toBe("awaiting_payment");
  });
});

async function bookedJob(phone: string) {
  const j = await quotedJob(phone);
  const to = phone.slice(1);
  await tap(to, `book:${j.ref("Sanskar")}`);
  const [p] = await sql`select id from payments where job_id = ${j.id} and status = 'pending'`;
  await fetch(`${url}/pay/${p!.id}`, { method: "POST" });
  await background.settle();
  expect((await job(j.id)).status).toBe("booked");
  return { ...j, jobRef: (await job(j.id)).ref as string, to };
}
const lastTo = (to: string) => sent.filter((s) => s.to === to).at(-1)!;
const SANSKAR_WA = "919000000003";

describe("cancelling on WhatsApp", () => {
  it("asks first, then refunds the full fee when the customer cancels before the worker sets out", async () => {
    const j = await bookedJob("+919100000031");
    expect(lastTo(j.to).buttons).toEqual([`cancel:${j.jobRef}`]);
    await tap(j.to, `cancel:${j.jobRef}`);
    expect(lastTo(j.to).text).toContain("poore ₹29 wapas");
    expect(lastTo(j.to).buttons).toEqual([`cancel_yes:${j.jobRef}`, "cancel_no"]);
    expect((await job(j.id)).status).toBe("booked");

    await tap(j.to, `cancel_yes:${j.jobRef}`);
    expect((await job(j.id)).status).toBe("cancelled");
    expect(await sql`select refunded_inr from payments where job_id = ${j.id} and status = 'paid'`).toEqual([{ refunded_inr: 29 }]);
    expect(lastTo(j.to).text).toContain("₹29 aapko wapas");
    expect(lastTo(SANSKAR_WA).text).toContain("Customer ne booking cancel kar di");
  });

  it("pays the worker ₹25 for travel when the customer cancels after the worker set out", async () => {
    const j = await bookedJob("+919100000032");
    expect(lastTo(SANSKAR_WA).buttons).toEqual([`trip:${j.jobRef}`, `wcancel:${j.jobRef}`]);
    await tap(SANSKAR_WA, `trip:${j.jobRef}`);
    expect(lastTo(j.to).text).toContain("Sanskar aapke kaam ke liye nikal chuke hain");

    await tap(j.to, `cancel:${j.jobRef}`);
    expect(lastTo(j.to).text).toContain("₹25 unke aane-jaane ke liye");
    await tap(j.to, `cancel_yes:${j.jobRef}`);
    expect(await sql`select refunded_inr from payments where job_id = ${j.id} and status = 'paid'`).toEqual([{ refunded_inr: 4 }]);
    expect(await sql`select amount_inr, reason from payouts where job_id = ${j.id}`).toEqual([{ amount_inr: 25, reason: "travel" }]);
    expect(lastTo(SANSKAR_WA).text).toContain("Aane-jaane ka paisa: ₹25");
  });

  it("refunds in full with ₹25 credit when the worker can't come, and uses the credit on the next booking", async () => {
    const j = await bookedJob("+919100000033");
    await tap(SANSKAR_WA, `wcancel:${j.jobRef}`);
    expect((await job(j.id)).status).toBe("booked");
    await tap(SANSKAR_WA, `wcancel_yes:${j.jobRef}`);
    expect((await job(j.id)).status).toBe("cancelled");
    expect(lastTo(j.to).text).toContain("Maafi ka credit: ₹25");
    expect(lastTo(j.to).text).toContain("Suvidha credit: ₹25");

    clock = NOON_IST;
    const next = await quotedJob("+919100000033");
    await tap(j.to, `book:${next.ref("Sanskar")}`);
    expect(await sql`select fee_inr, credit_inr, amount_inr from payments where job_id = ${next.id}`).toEqual([{ fee_inr: 29, credit_inr: 25, amount_inr: 4 }]);
    expect(lastTo(j.to).text).toContain("₹25 aapke credit se, ab ₹4 baaki");
  });

  it("treats a worker who never set out as a no-show and calls them last for two days", async () => {
    const j = await bookedJob("+919100000034");
    clock = new Date("2026-10-27T12:31:00Z"); // 31 minutes after Sanskar's 5:30 pm arrival
    await tap(j.to, `cancel:${j.jobRef}`);
    expect(lastTo(j.to).text).toContain("abhi tak nahi nikle");
    await tap(j.to, `cancel_yes:${j.jobRef}`);
    expect(await sql`select cancel_cause from bookings where job_id = ${j.id}`).toEqual([{ cancel_cause: "no_show" }]);
    expect(lastTo(j.to).text).toContain("Maafi ka credit: ₹25");

    clock = NOON_IST;
    const next = await intakeCall("+919100000035");
    await tick(inSeconds(61));
    expect((await callsFor(next.id)).map((c) => c.to)).not.toContain(SANSKAR);
    await sql`update workers set last_no_show_at = null`;
  });

  it("lets the customer cancel a request from the shortlist; workers who quoted are told", async () => {
    const j = await quotedJob("+919100000036");
    const shortlist = sent.find((s) => s.kind === "list" && s.to === "919100000036")!;
    expect(shortlist.list!.sections.at(-1)!.rows).toEqual([{ id: `cancel:${(await job(j.id)).ref}`, title: "Request cancel karein" }]);
    await tap("919100000036", `cancel_yes:${(await job(j.id)).ref}`);
    expect((await job(j.id)).status).toBe("cancelled");
    expect(lastTo("919100000036").text).toContain("Request cancel ho gayi");
    expect(lastTo(SANSKAR_WA).text).toContain("request cancel kar di");
  });

  it("only lets the job's own customer and worker cancel it", async () => {
    const j = await bookedJob("+919100000037");
    await tap("919100000099", `cancel_yes:${j.jobRef}`);
    await tap("919000000101", `wcancel_yes:${j.jobRef}`);
    expect((await job(j.id)).status).toBe("booked");
  });

  it("lets the team cancel a booking with a full refund and apology credit", async () => {
    const j = await bookedJob("+919100000038");
    expect(await suvidhaCancels(ctx, j.jobRef)).toBe(true);
    expect(await sql`select cancel_cause from bookings where job_id = ${j.id}`).toEqual([{ cancel_cause: "suvidha" }]);
    expect(lastTo(j.to).text).toContain("humein yeh booking cancel karni padi");
    expect(await suvidhaCancels(ctx, j.jobRef)).toBe(false);
  });

  it("cancels a booking made before the booking fee, with nothing to refund", async () => {
    const j = await bookedJob("+919100000039");
    await sql`delete from payments where job_id = ${j.id}`;
    expect(await suvidhaCancels(ctx, j.jobRef)).toBe(true);
    expect(await sql`select amount_inr, reason from credits c join customers u on u.id = c.customer_id where u.phone = '+919100000039'`)
      .toEqual([{ amount_inr: 25, reason: "apology" }]);
    expect(lastTo(j.to).text).not.toContain("wapas bhej");
  });
});

describe("a call that left fields empty", () => {
  const phone = "+919100000002";

  it("stays a draft and asks one question at a time on WhatsApp until the card is complete", async () => {
    const j = await intakeCall(phone, { time_window: "", time_window_latest: "", priority_first: "" });
    expect(j).toMatchObject({ status: "draft", missing_fields: ["time_window", "priority"], urgency: "flexible" });
    expect(sent.map((s) => s.text.slice(0, 16))).toEqual(["*Aapki Suvidha r", "Kaam kab tak ho "]);
    expect((await job(j.id)).pending_question).toBe("time_window");

    await text("919100000002", "kal subah tak");
    expect(await job(j.id)).toMatchObject({ time_window_text: "kal subah tak", pending_question: "priority", status: "draft" });

    await text("919100000002", "pata nahi");
    expect((await job(j.id)).pending_question).toBe("priority");

    await text("919100000002", "jo sabse jaldi aa sake");
    expect(await job(j.id)).toMatchObject({ status: "confirmed", priorities: ["speed"], missing_fields: [], pending_question: null });
    expect(sent.at(-1)!.text).toContain("Dhanyavaad");
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

describe("a real Bolna extraction", () => {
  it("builds a draft from Bolna's result objects and asks for the missing fields", async () => {
    const result = (objective: string | null, subjective: string | null) => ({
      objective, subjective, confidence: 0.9, validation: null, confidence_label: "High", reasoning_objective: null, reasoning_subjective: null,
    });
    const who = await lookup("customer", "+919100000008");
    for (const status of ["ringing", "in-progress", "call-disconnected"]) await callWebhook({ id: who.executionId, status, conversation_duration: 0 });
    await callWebhook({
      id: who.executionId, status: "completed", conversation_duration: 68,
      extracted_data: { "Job Card": {
        trade: result("plumber", null),
        problem: result(null, "A tap in the bathroom is leaking and may need repair or replacement."),
        material: result("worker_brings", null),
        address: result(null, ""),
        budget: { ...result(null, ""), validation: { is_valid: false, expected_type: "numeric" } },
        time_window_day: result("today", null),
        priority_first: result(null, null),
      } },
    });
    const [j] = await sql`select * from jobs where execution_id = ${who.executionId}`;
    expect(j).toMatchObject({ status: "draft", trade: "plumber", material: "worker_brings", missing_fields: ["job_type", "address", "priority"] });
    expect(sent.filter((s) => s.to === "919100000008").map((s) => s.text.slice(0, 16))).toEqual(["*Aapki Suvidha r", "Kya kaam karwana"]);
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

  it("lets every call through in test mode: no daily limit, no flagging", async () => {
    ctx.customerLineMode = "test";
    for (let i = 0; i < 5; i++) expect(await lookup("customer", "+919100000013")).toHaveProperty("caller_ref");
    for (const id of ["exec-test-1", "exec-test-2"]) {
      await lookup("customer", "+919100000013", id);
      await callWebhook({ id, status: "completed", conversation_duration: 20, extracted_data: { General: { "Call Summary": "testing" } } });
    }
    expect(await lookup("customer", "+919100000013")).toHaveProperty("caller_ref");
    expect((await sql`select flagged_at from customers where phone = '+919100000013'`)[0]?.flagged_at ?? null).toBeNull();
    // The flag set in live mode above is ignored too.
    expect(await lookup("customer", "+919100000012")).toHaveProperty("caller_ref");
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

describe("the website demo", () => {
  it("runs a browser call's job on demo workers only, with its WhatsApp shown on the page", async () => {
    const started = await startDemo(ctx);
    if (!started.ok) throw new Error(`demo did not start: ${started.reason}`);
    const runId = (started.session as { run_id: string }).run_id;
    await callWebhook({ id: runId, status: "completed", conversation_duration: 90, extracted_data: { "Job Card": card() } });
    const callsBefore = calls.length;

    let feed = await demoFeed(ctx, started.phone, 0);
    expect(feed.job).toMatchObject({ trade: "carpenter", status: "confirmed" });
    expect(JSON.stringify(feed.messages[0]!.body)).toContain("Suvidha request");
    await demoReply(ctx, started.phone, { text: "Gate number 2 se aana" });

    clock = new Date(clock.getTime() + 61_000);
    await startDueInvites(ctx);
    for (let round = 0; round < 3; round++) {
      clock = new Date(clock.getTime() + 60_000);
      await answerSandboxCalls(ctx);
      await background.settle();
    }

    feed = await demoFeed(ctx, started.phone, 0);
    expect(feed.quotes.map((q) => q.status)).toEqual(["answered", "answered", "answered"]);
    expect(feed.messages.map((m) => m.kind)).toEqual(expect.arrayContaining(["sent", "list"]));
    const quoted = await sql`select w.phone from quotes q join workers w on w.id = q.worker_id join jobs j on j.id = q.job_id where j.ref = ${feed.job!.ref}`;
    expect(quoted.every((q) => q.phone.startsWith("+9100"))).toBe(true);
    expect(calls.slice(callsBefore).some((c) => c.to.startsWith("+9100"))).toBe(false);
    expect(sent.some((s) => s.to.startsWith("9100"))).toBe(false);
  });
});
