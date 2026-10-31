import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BolnaClient } from "../../src/clients/bolna.ts";
import type { MapsClient } from "../../src/clients/maps.ts";
import { fakePayments } from "../../src/clients/payments.ts";
import type { StorageClient } from "../../src/clients/storage.ts";
import type { WhatsAppClient } from "../../src/clients/whatsapp.ts";
import type { Ctx } from "../../src/core/context.ts";
import { migrate } from "../../src/db/migrate.ts";
import { seed } from "../../src/db/seed.ts";
import { coreServices } from "../../src/services.ts";
import { backgroundTasks } from "../helpers.ts";
import { resetDb, testSql } from "./helpers.ts";

const sql = testSql();
const sent: { to: string; text: string }[] = [];
const whatsapp: WhatsAppClient = {
  sendText: async (to, text) => (sent.push({ to, text }), `wamid.${sent.length}`),
  sendButtons: async (to, text) => (sent.push({ to, text }), `wamid.${sent.length}`),
  sendList: async (to, list) => (sent.push({ to, text: list.body }), `wamid.${sent.length}`),
  sendImage: async (to, _l, caption) => (sent.push({ to, text: caption }), `wamid.${sent.length}`),
  downloadMedia: async () => null,
};
const background = backgroundTasks();
const ctx: Ctx = {
  sql, whatsapp, payments: fakePayments("https://pay.test", () => {}),
  bolna: { call: async () => "exec" } as BolnaClient,
  storage: { upload: async () => true, signedUrl: async () => "" } as StorageClient,
  maps: { geocode: async () => null } as MapsClient,
  customerLine: null, workerLine: null, customerLineMode: "live",
  limits: { inviteDelaySec: 60, parallelCalls: 2, maxWorkerCalls: 6, quotesWanted: 3, callTimeoutSec: 300, extractionWaitSec: 120, paymentWindowSec: 300 },
  now: () => new Date(),
  log: () => {},
  background: background.run,
};
const services = coreServices(ctx);

const ASHA = "+919811111111";
const BIMAL = "+919822222222";
const WORKERS = ["+919000000001", "+919000000002", "+919000000003"];

async function jobWithQuotes(customerPhone: string, ref: string) {
  const [c] = await sql<{ id: string }[]>`insert into customers (phone, name, preferred_language) values (${customerPhone}, 'Test', 'hi') returning id`;
  const [j] = await sql<{ id: string }[]>`
    insert into jobs (customer_id, language, trade, job_type, problem, locality, status, ref)
    values (${c!.id}, 'hi', 'carpenter', 'door_repair', 'Darwaza band nahi hota', 'Civil Lines', 'quotes_in', ${ref}) returning id`;
  const workers = await sql<{ id: string }[]>`select id from workers where phone in ${sql(WORKERS)} order by phone`;
  for (const [i, w] of workers.slice(0, 2).entries()) {
    await sql`
      insert into quotes (ref, job_id, worker_id, call_order, call_status, available, price_type, price, earliest_arrival, rank, rank_group, quoted_at)
      values (${`${ref}Q${i}`}, ${j!.id}, ${w.id}, ${i + 1}, 'answered', true, 'fixed', ${350 + i * 50}, now() + interval '3 hours', ${i + 1}, 'ranked', now())`;
  }
}

async function codeFor(phone: string) {
  await background.settle();
  const msg = sent.filter((s) => s.to === phone.slice(1)).at(-1);
  return msg?.text.match(/\*(\d{6})\*/)?.[1];
}

beforeAll(async () => {
  await resetDb(sql);
  await migrate(sql);
  await seed(sql, WORKERS);
  await jobWithQuotes(ASHA, "AJOB");
  await jobWithQuotes(BIMAL, "BJOB");
});
afterAll(() => sql.end());

describe("web app login and customer data", () => {
  let token = "";

  it("sends a code on WhatsApp and gives a session for the right one", async () => {
    expect(await services.startLogin({ phone: "98111 11111", role: "customer" })).toEqual({ ok: true });
    const code = await codeFor(ASHA);
    expect(code).toMatch(/^\d{6}$/);

    const wrong = code === "000000" ? "111111" : "000000";
    expect(await services.verifyLogin({ phone: ASHA, role: "customer", code: wrong })).toEqual({ ok: false, error: "wrong_code" });
    const reply = await services.verifyLogin({ phone: ASHA, role: "customer", code: code! });
    expect(reply).toMatchObject({ ok: true, needsName: false });
    token = reply.ok ? reply.token : "";

    const session = await services.session(token);
    expect(session).toMatchObject({ phone: ASHA, role: "customer" });
    // A used code cannot log in twice.
    expect(await services.verifyLogin({ phone: ASHA, role: "customer", code: code! })).toEqual({ ok: false, error: "wrong_code" });
  });

  it("signs up a new customer and asks for a name", async () => {
    const NEW = "+919833333333";
    expect(await services.startLogin({ phone: "9833333333", role: "customer" })).toEqual({ ok: true });
    const code = await codeFor(NEW);
    expect(code).toMatch(/^\d{6}$/);
    const reply = await services.verifyLogin({ phone: NEW, role: "customer", code: code! });
    expect(reply).toMatchObject({ ok: true, needsName: true });

    const session = (await services.session(reply.ok ? reply.token : ""))!;
    expect(await services.customerProfile(session)).toEqual({ phone: NEW, name: null, credit: 0 });
    await services.setCustomerName(session, "Kavita");
    expect(await services.customerProfile(session)).toEqual({ phone: NEW, name: "Kavita", credit: 0 });
    expect(await services.customerJobs(session)).toEqual([]);
  });

  it("never sends a code to a number that is not a worker", async () => {
    const before = sent.length;
    expect(await services.startLogin({ phone: "9844444444", role: "worker" })).toEqual({ ok: true });
    await background.settle();
    expect(sent.length).toBe(before);
    expect(await services.verifyLogin({ phone: "9844444444", role: "worker", code: "123456" })).toEqual({ ok: false, error: "wrong_code" });
  });

  it("stops after three codes in fifteen minutes", async () => {
    await services.startLogin({ phone: BIMAL, role: "customer" });
    await services.startLogin({ phone: BIMAL, role: "customer" });
    await services.startLogin({ phone: BIMAL, role: "customer" });
    expect(await services.startLogin({ phone: BIMAL, role: "customer" })).toEqual({ ok: false, error: "too_many_codes" });
  });

  it("locks a code after five wrong tries", async () => {
    await sql`delete from login_codes where phone = ${BIMAL}`;
    await services.startLogin({ phone: BIMAL, role: "customer" });
    const code = await codeFor(BIMAL);
    for (let i = 0; i < 5; i++) await services.verifyLogin({ phone: BIMAL, role: "customer", code: "999999" === code ? "888888" : "999999" });
    expect(await services.verifyLogin({ phone: BIMAL, role: "customer", code: code! })).toEqual({ ok: false, error: "wrong_code" });
  });

  it("shows only the customer's own jobs", async () => {
    const session = (await services.session(token))!;
    const jobs = await services.customerJobs(session);
    expect(jobs.map((j) => j.ref)).toEqual(["AJOB"]);
    expect(await services.customerJob(session, "BJOB")).toBeNull();

    const job = (await services.customerJob(session, "AJOB"))!;
    expect(job.status).toBe("quotes_in");
    expect(job.quotes.map((q) => [q.ref, q.price, q.fee])).toEqual([["AJOBQ0", 350, 29], ["AJOBQ1", 400, 29]]);
  });

  it("books one of its own quotes, never someone else's, once the fee is paid", async () => {
    const session = (await services.session(token))!;
    expect(await services.bookForCustomer(session, "AJOB", "BJOBQ0")).toBe(false);
    const chosen = await services.bookForCustomer(session, "AJOB", "AJOBQ1");
    expect(chosen).toEqual({ payUrl: expect.stringMatching(/^https:\/\/pay\.test\/pay\/[0-9a-f-]{36}$/) });

    const payUrl = (chosen as { payUrl: string }).payUrl;

    const waiting = (await services.customerJob(session, "AJOB"))!;
    expect(waiting).toMatchObject({ status: "awaiting_payment", payment: { amount: 29, url: payUrl }, booking: null });
    expect(await services.payBooking(payUrl.split("/").at(-1)!)).toBe("paid");
    await background.settle();

    const job = (await services.customerJob(session, "AJOB"))!;
    expect(job).toMatchObject({ status: "booked", payment: null });
    expect(job.booking).toMatchObject({ stage: "booked", finishCode: null });
    expect(job.booking!.startCode).toMatch(/^\d{4}$/);
  });

  it("stops handing out codes after fifteen wrong guesses in a day", async () => {
    const phone = "+919833333333";
    await services.startLogin({ phone, role: "customer" });
    await sql`update login_codes set attempts = 15, created_at = now() - interval '1 hour' where phone = ${phone}`;
    expect(await services.startLogin({ phone, role: "customer" })).toEqual({ ok: false, error: "too_many_codes" });
  });

  it("drops the session of a blocked customer", async () => {
    const session = (await services.session(token))!;
    await sql`update customers set blocked = true where id = ${session.customerId}`;
    expect(await services.session(token)).toBeNull();
    await sql`update customers set blocked = false where id = ${session.customerId}`;
  });

  it("ends the session on logout", async () => {
    const session = (await services.session(token))!;
    await services.endSession(session.id);
    expect(await services.session(token)).toBeNull();
  });
});
