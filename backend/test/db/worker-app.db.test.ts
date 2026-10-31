import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BolnaClient } from "../../src/clients/bolna.ts";
import type { MapsClient } from "../../src/clients/maps.ts";
import { fakePayments } from "../../src/clients/payments.ts";
import type { StorageClient } from "../../src/clients/storage.ts";
import type { WhatsAppClient } from "../../src/clients/whatsapp.ts";
import type { Session } from "../../src/core/app-login.ts";
import type { Ctx } from "../../src/core/context.ts";
import { migrate } from "../../src/db/migrate.ts";
import { seed } from "../../src/db/seed.ts";
import { coreServices } from "../../src/services.ts";
import { backgroundTasks } from "../helpers.ts";
import { resetDb, testSql } from "./helpers.ts";

const sql = testSql();
const sent: { to: string; text: string }[] = [];
const out = (to: string, text: string) => (sent.push({ to, text }), Promise.resolve(`wamid.${sent.length}`));
const whatsapp: WhatsAppClient = {
  sendText: out,
  sendButtons: out,
  sendList: (to, list) => out(to, list.body),
  sendImage: (to, _l, caption) => out(to, caption),
  downloadMedia: async () => null,
};
const background = backgroundTasks();
const ctx: Ctx = {
  sql, whatsapp, payments: fakePayments("https://pay.test", () => {}),
  bolna: { call: async () => "exec", webSession: async () => ({ run_id: "web" }) } as BolnaClient,
  storage: { upload: async () => true, signedUrl: async (path) => `https://photos.test/${path}` } as StorageClient,
  maps: { geocode: async () => null } as MapsClient,
  customerLine: null, workerLine: null, customerLineMode: "live",
  // Two calls already placed and no room for more, so the job finishes as soon as both answer.
  limits: { inviteDelaySec: 60, parallelCalls: 2, maxWorkerCalls: 2, quotesWanted: 3, callTimeoutSec: 300, extractionWaitSec: 120, paymentWindowSec: 300 },
  now: () => new Date(),
  log: () => {},
  background: background.run,
};
const services = coreServices(ctx);

const WORKERS = ["+919000000001", "+919000000002", "+919000000003"];
const CUSTOMER = "+919811111111";

// One login per number: the login limit allows only three codes in 15 minutes.
const sessions = new Map<string, Session>();
async function login(phone: string, role: "customer" | "worker"): Promise<Session> {
  const known = sessions.get(phone);
  if (known) return known;
  await services.startLogin({ phone, role });
  await background.settle();
  const code = sent.filter((s) => s.to === phone.slice(1)).at(-1)!.text.match(/\*(\d{6})\*/)![1]!;
  const reply = await services.verifyLogin({ phone, role, code });
  const session = (await services.session(reply.ok ? reply.token : ""))!;
  sessions.set(phone, session);
  return session;
}

beforeAll(async () => {
  await resetDb(sql);
  await migrate(sql);
  await seed(sql, WORKERS);
  const [c] = await sql<{ id: string }[]>`insert into customers (phone, name, preferred_language) values (${CUSTOMER}, 'Asha', 'hi') returning id`;
  const [j] = await sql<{ id: string }[]>`
    insert into jobs (customer_id, language, trade, job_type, problem, locality, address, status, ref, priorities)
    values (${c!.id}, 'hi', 'plumber', 'tap_leak', 'Nal tapak raha hai', 'Civil Lines', 'H.No 12, Civil Lines', 'inviting', 'WJOB', ${["speed"]}) returning id`;
  const workers = await sql<{ id: string; phone: string }[]>`select id, phone from workers where phone in ${sql([WORKERS[0]!, WORKERS[1]!])} order by phone`;
  for (const [i, w] of workers.entries()) {
    await sql`insert into quotes (ref, job_id, worker_id, call_order, call_status, distance_km) values (${`WQ${i}`}, ${j!.id}, ${w.id}, ${i + 1}, 'calling', 1.5)`;
  }
});
afterAll(() => sql.end());

describe("worker app", () => {
  let nishant: Session;

  it("shows a new job with the area but not the address", async () => {
    nishant = await login(WORKERS[0]!, "worker");
    const home = await services.workerHome(nishant);
    expect(home.invites).toHaveLength(1);
    expect(home.invites[0]).toMatchObject({ quoteRef: "WQ0", state: "open", locality: "Civil Lines" });
    expect(JSON.stringify(home.invites)).not.toContain("H.No 12");
    expect(JSON.stringify(home.invites)).not.toContain(CUSTOMER.slice(3));
  });

  it("takes a quote and a decline from the app, then sends the customer the shortlist", async () => {
    expect(await services.quoteFromApp(nishant, "WQ0", { available: true, declineReason: null, priceType: "fixed", price: 350, visitCharge: null, materialIncluded: "yes", arrivalInMinutes: 60, note: null })).toBe(true);
    expect(await services.quoteFromApp(nishant, "WQ0", { available: false, declineReason: "busy", priceType: null, price: null, visitCharge: null, materialIncluded: null, arrivalInMinutes: null, note: null })).toBe(false);

    const other = await login(WORKERS[1]!, "worker");
    await services.quoteFromApp(other, "WQ1", { available: false, declineReason: "busy", priceType: null, price: null, visitCharge: null, materialIncluded: null, arrivalInMinutes: null, note: null });
    await background.settle();

    const [job] = await sql<{ status: string }[]>`select status from jobs where ref = 'WJOB'`;
    expect(job!.status).toBe("quotes_in");
    expect((await services.workerHome(nishant)).invites[0]).toMatchObject({ state: "sent", myQuote: { price: 350 } });
  });

  it("words the app's reasons in English though the customer called in Hindi", async () => {
    const asha = await login(CUSTOMER, "customer");
    const [quote] = (await services.customerJob(asha, "WJOB"))!.quotes;
    expect(quote).toMatchObject({ ref: "WQ0", reason: expect.stringMatching(/^Earliest arrival: (today|tomorrow) /) });
  });

  it("walks a booking through trip, start code, done and finish code", async () => {
    const asha = await login(CUSTOMER, "customer");
    const { payUrl } = (await services.bookForCustomer(asha, "WJOB", "WQ0")) as { payUrl: string };
    expect(await services.payBooking(payUrl.split("/").at(-1)!)).toBe("paid");
    await background.settle();
    const [codes] = await sql<{ start_otp: string; completion_otp: string }[]>`select start_otp, completion_otp from bookings`;

    let home = await services.workerHome(nishant);
    expect(home.active[0]).toMatchObject({ jobRef: "WJOB", stage: "booked", address: "H.No 12, Civil Lines", customer: "Asha", callNumber: CUSTOMER });

    expect(await services.bookingStep(nishant, "WJOB", { kind: "trip" })).toEqual({ ok: true });
    await background.settle();
    expect(sent.at(-1)!.text).toContain(codes!.start_otp);

    const wrong = codes!.start_otp === "0000" ? "1111" : "0000";
    for (let i = 0; i < 5; i++) expect(await services.bookingStep(nishant, "WJOB", { kind: "start", code: wrong })).toEqual({ ok: false, error: "wrong_code" });
    expect(await services.bookingStep(nishant, "WJOB", { kind: "start", code: codes!.start_otp })).toEqual({ ok: false, error: "code_locked" });
    await sql`update bookings set code_attempts = 0`;
    expect(await services.bookingStep(nishant, "WJOB", { kind: "start", code: codes!.start_otp })).toEqual({ ok: true });

    expect(await services.bookingStep(nishant, "WJOB", { kind: "finish", code: codes!.completion_otp })).toEqual({ ok: false, error: "wrong_step" });
    expect(await services.bookingStep(nishant, "WJOB", { kind: "done", finalPrice: 400 })).toEqual({ ok: true });
    await background.settle();
    expect(sent.at(-1)).toMatchObject({ to: CUSTOMER.slice(1) });
    expect(sent.at(-1)!.text).toContain(codes!.completion_otp);
    expect((await services.customerJob(asha, "WJOB"))!.booking).toMatchObject({ stage: "done", finishCode: codes!.completion_otp });

    expect(await services.bookingStep(nishant, "WJOB", { kind: "finish", code: codes!.completion_otp })).toEqual({ ok: true });
    const [job] = await sql<{ status: string }[]>`select status from jobs where ref = 'WJOB'`;
    expect(job!.status).toBe("done");

    home = await services.workerHome(nishant);
    expect(home.active).toEqual([]);
    expect(home.earnings).toMatchObject({ jobs: 1, total: 400 });
    expect(home.recent[0]).toMatchObject({ jobRef: "WJOB", price: 400 });
  });

  it("lets a worker go offline", async () => {
    await services.setOnline(nishant, false);
    expect((await services.workerHome(nishant)).profile.online).toBe(false);
  });

  it("answers the waiting question for the job the app names", async () => {
    const asha = await login(CUSTOMER, "customer");
    const [c] = await sql<{ id: string }[]>`select id from customers where phone = ${CUSTOMER}`;
    await sql`
      insert into jobs (customer_id, language, trade, job_type, problem, material, time_window_text, status, ref, priorities, missing_fields, pending_question)
      values (${c!.id}, 'hi', 'plumber', 'tap_repair', 'Nal tapak raha hai', 'customer_has', 'kal subah', 'draft', 'DRAFT1', ${["speed"]}, ${["address"]}, 'address')`;
    expect((await services.customerJob(asha, "DRAFT1"))!.question).toEqual({ field: "address", text: "Please share your full address with a nearby landmark." });

    expect(await services.messageForJob(asha, "WJOB", "Ghar 5")).toBeNull();
    expect(await services.messageForJob(asha, "DRAFT1", "H.No 5, Civil Lines")).toBe("answered");
    const job = (await services.customerJob(asha, "DRAFT1"))!;
    expect(job).toMatchObject({ status: "confirmed", address: "H.No 5, Civil Lines", question: null });
  });

  it("passes a note and a checked photo to the workers called", async () => {
    const asha = await login(CUSTOMER, "customer");
    const [c] = await sql<{ id: string }[]>`select id from customers where phone = ${CUSTOMER}`;
    const [j] = await sql<{ id: string }[]>`
      insert into jobs (customer_id, language, trade, job_type, problem, locality, address, status, ref, priorities)
      values (${c!.id}, 'hi', 'electrician', 'fan', 'Pankha band', 'Civil Lines', 'H.No 9, Civil Lines', 'inviting', 'WJOB2', ${["speed"]}) returning id`;
    const workers = await sql<{ id: string }[]>`select id from workers where phone in ${sql([WORKERS[0]!, WORKERS[1]!])} order by phone`;
    for (const [i, w] of workers.entries()) {
      await sql`insert into quotes (ref, job_id, worker_id, call_order, call_status, distance_km, called_at) values (${`WQ2${i}`}, ${j!.id}, ${w.id}, ${i + 1}, 'calling', 2, now())`;
    }

    expect(await services.messageForJob(asha, "WJOB2", "Gate is blue")).toBe("noted");
    expect(await services.photoForJob(asha, "WJOB2", { bytes: new Uint8Array([60, 104, 116, 109]), mimeType: "image/jpeg" })).toBe("bad_photo");
    expect(await services.photoForJob(asha, "WJOB2", { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]), mimeType: "image/jpeg" })).toBe("saved");

    const invite = (await services.workerHome(nishant)).invites.find((i) => i.jobRef === "WJOB2")!;
    expect(invite).toMatchObject({ notes: ["Gate is blue"], photoUrl: expect.stringMatching(/^https:\/\/photos\.test\/WJOB2\/app_.+\.jpg$/) });
    expect((await services.customerJob(asha, "WJOB2"))!.photoUrl).toBe(invite.photoUrl);

    ctx.storage.upload = async () => false;
    expect(await services.photoForJob(asha, "WJOB2", { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe1]), mimeType: "image/jpeg" })).toBe("not_stored");
    ctx.storage.upload = async () => true;
    expect((await services.customerJob(asha, "WJOB2"))!.photoUrl).toBe(invite.photoUrl);
  });

  it("tells the customer what a cancel costs, then pays the worker's travel", async () => {
    const asha = await login(CUSTOMER, "customer");
    const other = await login(WORKERS[1]!, "worker");
    await services.quoteFromApp(nishant, "WQ20", { available: true, declineReason: null, priceType: "fixed", price: 300, visitCharge: null, materialIncluded: "no", arrivalInMinutes: 30, note: null });
    await services.quoteFromApp(other, "WQ21", { available: false, declineReason: "busy", priceType: null, price: null, visitCharge: null, materialIncluded: null, arrivalInMinutes: null, note: null });
    await background.settle();
    expect((await services.customerJob(asha, "WJOB2"))!.canCancel).toMatchObject({ booked: false, cashBack: 0 });

    const { payUrl } = (await services.bookForCustomer(asha, "WJOB2", "WQ20")) as { payUrl: string };
    await services.payBooking(payUrl.split("/").at(-1)!);
    await services.bookingStep(nishant, "WJOB2", { kind: "trip" });
    await background.settle();
    expect((await services.customerJob(asha, "WJOB2"))!.canCancel).toEqual({ booked: true, worker: "Nishant", cashBack: 4, creditBack: 0, apology: 0, travelPay: 25 });

    expect(await services.cancelForWorker(other, "WJOB2")).toBe(false);
    expect(await services.cancelForCustomer(asha, "WJOB2")).toBe(true);
    const job = (await services.customerJob(asha, "WJOB2"))!;
    expect(job).toMatchObject({ status: "cancelled", canCancel: null, cancelled: { by: "customer_after_trip", worker: "Nishant", refund: 4, credit: 0 } });
    expect(job.booking).toMatchObject({ stage: "cancelled", startCode: null, finishCode: null });

    const home = await services.workerHome(nishant);
    expect(home.earnings).toMatchObject({ travelTotal: 25, travelMonth: 25 });
    expect(home.travel[0]).toMatchObject({ jobRef: "WJOB2", amount: 25 });
  });

  it("shows the customer's credit and the worker's no-show penalty", async () => {
    const asha = await login(CUSTOMER, "customer");
    const [c] = await sql<{ id: string }[]>`select id from customers where phone = ${CUSTOMER}`;
    await sql`insert into credits (customer_id, amount_inr, reason) values (${c!.id}, 25, 'apology')`;
    expect(await services.customerProfile(asha)).toMatchObject({ credit: 25 });

    expect((await services.workerHome(nishant)).profile.calledLastUntil).toBeNull();
    await sql`update workers set last_no_show_at = now() where phone = ${WORKERS[0]!}`;
    expect((await services.workerHome(nishant)).profile.calledLastUntil).toEqual(expect.any(String));
  });
});
