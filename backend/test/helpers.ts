import type { AddressInfo } from "node:net";
import { createApp, type AppDeps } from "../src/app.ts";
import type { SaveWebhook, WebhookEntry } from "../src/http/webhook-log.ts";
import type { Services } from "../src/services.ts";

export const secrets = {
  BOLNA_FUNCTION_TOKEN: "test-function-token-0123456789",
  BOLNA_WEBHOOK_TOKEN: "test-webhook-token-0123456789",
  WHATSAPP_APP_SECRET: "test-app-secret",
  WHATSAPP_VERIFY_TOKEN: "test-verify-token",
  APP_API_TOKEN: "test-app-token-0123456789",
};

// Same dedup rule as the webhook_log unique index.
export function memoryWebhookLog() {
  const entries: WebhookEntry[] = [];
  const seen = new Set<string>();
  const save: SaveWebhook = async (e) => {
    if (e.externalId !== null) {
      const key = `${e.source}:${e.externalId}`;
      if (seen.has(key)) return "duplicate";
      seen.add(key);
    }
    entries.push(e);
    return "new";
  };
  return { entries, save };
}

// Records what each route passed to the core and answers with fixed replies.
export function stubServices() {
  const calls: { name: keyof Services; input: unknown }[] = [];
  const record = <T>(name: keyof Services, reply: T) => async (input: unknown) => {
    calls.push({ name, input });
    return reply;
  };
  const services: Services = {
    lookupCustomer: record("lookupCustomer", { call_type: "inbound", caller_ref: "C7Q4" }),
    lookupWorker: record("lookupWorker", { call_type: "inbound", caller_ref: "W7Q4" }),
    registerWorker: record("registerWorker", { ok: true as const }),
    callStatus: record("callStatus", undefined),
    whatsappEvent: record("whatsappEvent", undefined),
    startLogin: record("startLogin", { ok: true as const }),
    verifyLogin: record("verifyLogin", { ok: true as const, token: "tok", role: "customer" as const, needsName: false }),
    session: async (token: string) => {
      calls.push({ name: "session", input: token });
      if (token === "worker") return { id: "s2", phone: "+919000000001", role: "worker" as const, customerId: null, workerId: "w1" };
      return token === "good" ? { id: "s1", phone: "+919876543210", role: "customer" as const, customerId: "c1", workerId: null } : null;
    },
    endSession: record("endSession", undefined),
    customerJobs: record("customerJobs", []),
    customerJob: async (_s: unknown, ref: string) => {
      calls.push({ name: "customerJob", input: ref });
      return ref === "MINE" ? ({ ref } as never) : null;
    },
    bookForCustomer: record("bookForCustomer", { payUrl: "https://pay.test/pay/p1" }),
    customerProfile: record("customerProfile", { phone: "+919876543210", name: "Asha", credit: 0 }),
    setCustomerName: record("setCustomerName", undefined),
    messageForJob: record("messageForJob", "noted" as const),
    photoForJob: record("photoForJob", "saved" as const),
    cancelForCustomer: record("cancelForCustomer", true),
    cancelForWorker: record("cancelForWorker", true),
    workerHome: record("workerHome", {
      profile: { name: "Nishant", trades: ["electrician"], verified: true, rating: null, online: true, calledLastUntil: null },
      invites: [], active: [], earnings: { jobs: 0, total: 0, monthJobs: 0, monthTotal: 0, travelTotal: 0, travelMonth: 0 }, travel: [], recent: [],
    }),
    setOnline: record("setOnline", undefined),
    quoteFromApp: record("quoteFromApp", true),
    bookingStep: async (_s: unknown, _ref: string, step: unknown) => {
      calls.push({ name: "bookingStep", input: step });
      return { ok: true as const };
    },
    paymentView: record("paymentView", null),
    demoStart: async () => ({ ok: true as const, phone: "+910012345678", session: { run_id: "web-1" } }),
    demoFeed: record("demoFeed", { messages: [], job: null, quotes: [] }),
    demoReply: async (phone: string, reply: unknown) => void calls.push({ name: "demoReply", input: { phone, reply } }),
    payBooking: record("payBooking", "expired" as const),
  };
  return { services, calls };
}

// Collects work the routes push past the reply, so tests can wait for it.
export function backgroundTasks() {
  const pending: Promise<void>[] = [];
  return {
    run: (task: () => Promise<void>) => {
      pending.push(task());
    },
    settle: async () => {
      while (pending.length) await pending.shift();
    },
  };
}

export function startApp(overrides: Partial<AppDeps> = {}) {
  const log = memoryWebhookLog();
  const stub = stubServices();
  const background = backgroundTasks();
  const app = createApp({
    pingDb: async () => 1,
    version: "test",
    secrets,
    saveWebhook: log.save,
    services: stub.services,
    background: background.run,
    log: () => {},
    ...overrides,
  });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, log, calls: stub.calls, settle: background.settle, close: () => server.close() };
}
