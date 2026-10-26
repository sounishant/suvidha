import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { secrets, startApp } from "./helpers.ts";

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

const createJob = JSON.stringify({ from_number: "+919876543210", execution_id: "exec-1", trade: "plumber" });

describe("Bolna functions and lookups", () => {
  it("rejects a missing or wrong token without logging", async () => {
    expect((await post("/bolna/fn/create_job", createJob, {})).status).toBe(401);
    expect((await post("/bolna/fn/create_job", createJob, { authorization: "Bearer nope" })).status).toBe(401);
    expect(app.log.entries).toHaveLength(0);
  });

  it("logs the raw body and blanks out the token", async () => {
    const res = await post("/bolna/fn/create_job", createJob, bearer);
    expect(res.status).toBe(501);
    expect(app.log.entries).toEqual([
      expect.objectContaining({ source: "bolna_fn", externalId: null, path: "/bolna/fn/create_job", body: createJob }),
    ]);
    expect(app.log.entries[0]!.headers.authorization).toBe("[redacted]");
  });

  it("never dedups function calls, so a create_job retry in the same call goes through", async () => {
    await post("/bolna/fn/create_job", createJob, bearer);
    const retry = await post("/bolna/fn/create_job", createJob, bearer);
    expect(await retry.json()).not.toHaveProperty("duplicate");
    expect(app.log.entries).toHaveLength(2);
  });

  it("still logs a body that is not valid JSON", async () => {
    await post("/bolna/fn/report_prank", "{not json", bearer);
    expect(app.log.entries[0]).toMatchObject({ source: "bolna_fn", body: "{not json" });
  });

  it("returns 404 for a function that is not in the contract", async () => {
    expect((await post("/bolna/fn/drop_tables", "{}", bearer)).status).toBe(404);
  });

  it("logs a lookup with its query string", async () => {
    const res = await fetch(`${app.url}/bolna/lookup/customer?contact_number=%2B919876543210&execution_id=e1`, { headers: bearer });
    expect(res.status).toBe(501);
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
    expect((await post("/bolna/webhook", status("completed"), { "x-suvidha-token": "nope" })).status).toBe(401);
    expect(app.log.entries).toHaveLength(0);
  });

  it("keeps each status once and ignores a repeat of the same status", async () => {
    expect(await (await post("/bolna/webhook", status("in-progress"), hook)).json()).toEqual({ ok: true });
    expect(await (await post("/bolna/webhook", status("completed"), hook)).json()).toEqual({ ok: true });
    expect(await (await post("/bolna/webhook", status("completed"), hook)).json()).toEqual({ ok: true, duplicate: true });
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
