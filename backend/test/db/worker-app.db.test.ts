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
  bolna: { call: async () => "exec" } as BolnaClient,
  storage: { upload: async () => true, signedUrl: async () => "" } as StorageClient,
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

async function login(phone: string, role: "customer" | "worker"): Promise<Session> {
  await services.startLogin({ phone, role });
  await background.settle();
  const code = sent.filter((s) => s.to === phone.slice(1)).at(-1)!.text.match(/\*(\d{6})\*/)![1]!;
  const reply = await services.verifyLogin({ phone, role, code });
  return (await services.session(reply.ok ? reply.token : ""))!;
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
    expect(home.active[0]).toMatchObject({ jobRef: "WJOB", stage: "booked", address: "H.No 12, Civil Lines", customer: "Asha" });

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
});
