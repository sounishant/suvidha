import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { secrets, startApp, stubServices } from "./helpers.ts";

let app: ReturnType<typeof startApp>;
beforeEach(() => {
  app = startApp();
});
afterEach(() => app.close());

const bearer = { authorization: `Bearer ${secrets.BOLNA_FUNCTION_TOKEN}` };

function post(path: string, body: string, headers: Record<string, string>) {
  return fetch(`${app.url}${path}`, { method: "POST", body, headers: { "content-type": "application/json", ...headers } });
}

function signed(body: string) {
  return { "x-hub-signature-256": `sha256=${createHmac("sha256", secrets.WHATSAPP_APP_SECRET).update(body).digest("hex")}` };
}

const register = JSON.stringify({ caller_ref: "W7Q4", name: "Mohit", trades: "electrician", consent_ai_calls: "yes" });

describe("Bolna functions and lookups", () => {
  it("rejects a missing or wrong token without logging", async () => {
    expect((await post("/bolna/fn/register_worker", register, {})).status).toBe(401);
    expect((await post("/bolna/fn/register_worker", register, { authorization: "Bearer nope" })).status).toBe(401);
    expect(app.log.entries).toHaveLength(0);
  });

  it("logs the raw body and blanks out the token", async () => {
    const res = await post("/bolna/fn/register_worker", register, bearer);
    expect(await res.json()).toEqual({ ok: true });
    expect(app.log.entries).toEqual([
      expect.objectContaining({ source: "bolna_fn", externalId: null, path: "/bolna/fn/register_worker", body: register }),
    ]);
    expect(app.log.entries[0]!.headers.authorization).toBe("[redacted]");
  });

  it("never dedups function calls, so a retry in the same call goes through", async () => {
    await post("/bolna/fn/register_worker", register, bearer);
    const retry = await post("/bolna/fn/register_worker", register, bearer);
    expect(await retry.json()).not.toHaveProperty("duplicate");
    expect(app.log.entries).toHaveLength(2);
  });

  it("still logs a body that is not valid JSON", async () => {
    await post("/bolna/fn/register_worker", "{not json", bearer);
    expect(app.log.entries[0]).toMatchObject({ source: "bolna_fn", body: "{not json" });
  });

  it("returns 404 for a function that is not in the contract", async () => {
    expect((await post("/bolna/fn/drop_tables", "{}", bearer)).status).toBe(404);
  });

  it("logs a lookup with its query string", async () => {
    const res = await fetch(`${app.url}/bolna/lookup/customer?contact_number=%2B919876543210&execution_id=e1`, { headers: bearer });
    expect(await res.json()).toEqual({ call_type: "inbound", caller_ref: "C7Q4" });
    expect(app.log.entries[0]).toMatchObject({
      source: "bolna_lookup",
      path: "/bolna/lookup/customer?contact_number=%2B919876543210&execution_id=e1",
      body: "",
    });
  });
});

describe("Bolna call webhook", () => {
  const hook = { "x-suvidha-token": secrets.BOLNA_WEBHOOK_TOKEN };
  const status = (s: string) => JSON.stringify({ id: "call-1", status: s, conversation_duration: 0 });

  it("rejects a wrong token", async () => {
    expect((await post("/bolna/webhook/call", status("completed"), { "x-suvidha-token": "nope" })).status).toBe(401);
    expect(app.log.entries).toHaveLength(0);
  });

  it("keeps each status once and ignores a repeat of the same status", async () => {
    expect(await (await post("/bolna/webhook/call", status("in-progress"), hook)).json()).toEqual({ ok: true });
    expect(await (await post("/bolna/webhook/call", status("completed"), hook)).json()).toEqual({ ok: true });
    expect(await (await post("/bolna/webhook/call", status("completed"), hook)).json()).toEqual({ ok: true, duplicate: true });
    expect(app.log.entries.map((e) => e.externalId)).toEqual(["call-1:in-progress", "call-1:completed"]);
    expect(app.log.entries[0]!.headers["x-suvidha-token"]).toBe("[redacted]");
  });
});

describe("WhatsApp webhook", () => {
  const confirmTap = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: [{ field: "messages", value: {
      messages: [{ from: "919876543210", id: "wamid.A", type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "confirm:job-1", title: "Confirm" } } }],
    } }] }],
  });

  it("accepts a correctly signed event once and ignores Meta's retry", async () => {
    expect(await (await post("/whatsapp/webhook", confirmTap, signed(confirmTap))).json()).toEqual({ ok: true });
    expect(await (await post("/whatsapp/webhook", confirmTap, signed(confirmTap))).json()).toEqual({ ok: true, duplicate: true });
    expect(app.log.entries).toEqual([expect.objectContaining({ source: "whatsapp", externalId: "wamid.A", body: confirmTap })]);
  });

  it("rejects a bad signature or a body changed after signing", async () => {
    expect((await post("/whatsapp/webhook", confirmTap, { "x-hub-signature-256": "sha256=00" })).status).toBe(401);
    expect((await post("/whatsapp/webhook", confirmTap.replace("job-1", "job-2"), signed(confirmTap))).status).toBe(401);
    expect(app.log.entries).toHaveLength(0);
  });

  it("dedups delivery statuses by message id and status", async () => {
    const statusEvent = (s: string) =>
      JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.Z", status: s }] } }] }] });
    for (const s of ["sent", "delivered", "delivered"]) await post("/whatsapp/webhook", statusEvent(s), signed(statusEvent(s)));
    expect(app.log.entries.map((e) => e.externalId)).toEqual(["wamid.Z:sent", "wamid.Z:delivered"]);
  });

  it("answers Meta's verification handshake only with the right token", async () => {
    const ok = await fetch(`${app.url}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${secrets.WHATSAPP_VERIFY_TOKEN}&hub.challenge=123`);
    expect([ok.status, await ok.text()]).toEqual([200, "123"]);
    const bad = await fetch(`${app.url}/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=123`);
    expect(bad.status).toBe(403);
  });
});

describe("Bolna function inputs", () => {
  it("cleans what the agent sends before it reaches the core", async () => {
    const body = { caller_ref: " w7-q4 ", name: "Mohit", trades: "electrician", skills: 7, areas: "Civil Lines",
      working_hours: "9 to 7", has_smartphone: "हाँ", language: "HI", consent_ai_calls: "haan" };
    await post("/bolna/fn/register_worker", JSON.stringify(body), bearer);
    expect(app.calls[0]).toEqual({ name: "registerWorker", input: {
      callerRef: "W7Q4", name: "Mohit", trades: "electrician", skills: "7", areas: "Civil Lines",
      workingHours: "9 to 7", hasSmartphone: true, language: "hi", consent: true,
    } });
  });

  it("answers a failure with a polite line in the caller's language", async () => {
    app.close();
    app = startApp({ services: { ...stubServices().services, registerWorker: async () => { throw new Error("db down"); } } });
    const reply = await (await post("/bolna/fn/register_worker", JSON.stringify({ caller_ref: "W7Q4", language: "en" }), bearer)).json();
    expect(reply).toEqual({ ok: false, say: expect.stringContaining("Sorry") });
  });

  it("returns 404 for the functions the job card replaced", async () => {
    for (const name of ["create_job", "confirm_job", "respond_to_offer"]) expect((await post(`/bolna/fn/${name}`, "{}", bearer)).status).toBe(404);
  });

  it("passes the caller's number in E.164 to the lookup", async () => {
    await fetch(`${app.url}/bolna/lookup/worker?contact_number=919812345678&execution_id=e9`, { headers: bearer });
    expect(app.calls[0]).toEqual({ name: "lookupWorker", input: { phone: "+919812345678", executionId: "e9" } });
  });

  it("hands each call status to the core after replying", async () => {
    await post("/bolna/webhook/call", JSON.stringify({ id: "call-9", status: "completed", conversation_duration: "41", total_cost: 2.5 }),
      { "x-suvidha-token": secrets.BOLNA_WEBHOOK_TOKEN });
    await app.settle();
    expect(app.calls[0]).toEqual({ name: "callStatus", input: { id: "call-9", status: "completed", conversation_duration: 41, total_cost: 2.5, caller_ref: undefined } });
  });

  it("passes the extraction and the caller code Bolna echoes back", async () => {
    const body = { id: "call-10", status: "completed", extracted_data: { trade: "plumber" }, context_details: { recipient_data: { caller_ref: "C7Q4", timezone: "Asia/Kolkata" } } };
    await post("/bolna/webhook/call", JSON.stringify(body), { "x-suvidha-token": secrets.BOLNA_WEBHOOK_TOKEN });
    await app.settle();
    expect(app.calls[0]!.input).toMatchObject({ id: "call-10", extracted_data: { trade: "plumber" }, caller_ref: "C7Q4" });
  });
});
