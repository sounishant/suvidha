import { randomUUID } from "node:crypto";
import type { Config } from "../src/config.ts";
import { whatsappSignature } from "../src/http/auth.ts";
import * as payloads from "./payloads.ts";

export type Target = {
  baseUrl: string;
  secrets: Pick<Config, "BOLNA_FUNCTION_TOKEN" | "BOLNA_WEBHOOK_TOKEN" | "WHATSAPP_APP_SECRET" | "WHATSAPP_VERIFY_TOKEN">;
};

export type Check = { name: string; pass: boolean; detail: string };

async function call(target: Target, path: string, init: { body?: object | string; headers?: Record<string, string> } = {}) {
  const body = typeof init.body === "object" ? JSON.stringify(init.body) : init.body;
  const res = await fetch(`${target.baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    body,
    headers: { "content-type": "application/json", ...init.headers },
  });
  const text = await res.text();
  return { status: res.status, text };
}

// Auth, logging and dedup on every endpoint; booking-flow.ts covers what the endpoints do.
export async function runWebhookChecks(target: Target): Promise<Check[]> {
  const { secrets } = target;
  const bearer = { authorization: `Bearer ${secrets.BOLNA_FUNCTION_TOKEN}` };
  const hookToken = { "x-suvidha-token": secrets.BOLNA_WEBHOOK_TOKEN };
  const signed = (body: object) => {
    const raw = JSON.stringify(body);
    return { body: raw, headers: { "x-hub-signature-256": whatsappSignature(secrets.WHATSAPP_APP_SECRET, raw) } };
  };

  const checks: Check[] = [];
  const expect = (name: string, got: { status: number; text: string }, status: number, text?: string) =>
    checks.push({
      name,
      pass: got.status === status && (text === undefined || got.text === text),
      detail: `${got.status} ${got.text.slice(0, 80)}`,
    });

  expect("health answers", await call(target, "/health"), 200);

  expect("customer lookup without token is refused", await call(target, "/bolna/lookup/customer?contact_number=%2B919876543210"), 401);
  expect("customer lookup with token is answered", await call(target, `/bolna/lookup/customer?contact_number=%2B911000000000&execution_id=${randomUUID()}`, { headers: bearer }), 200);
  expect("worker lookup with token is answered", await call(target, `/bolna/lookup/worker?contact_number=%2B911000000000&execution_id=${randomUUID()}`, { headers: bearer }), 200);

  const join = payloads.registerWorker();
  expect("register_worker with a wrong token is refused", await call(target, "/bolna/fn/register_worker", { body: join, headers: { authorization: "Bearer wrong" } }), 401);
  expect("register_worker is answered", await call(target, "/bolna/fn/register_worker", { body: join, headers: bearer }), 200);
  expect("register_worker retry in the same call is not dropped", await call(target, "/bolna/fn/register_worker", { body: join, headers: bearer }), 200);

  const callId = randomUUID();
  for (const status of ["ringing", "in-progress", "completed"]) {
    expect(`call webhook '${status}' is logged`, await call(target, "/bolna/webhook/call", { body: payloads.bolnaCallStatus(callId, status), headers: hookToken }), 200, '{"ok":true}');
  }
  expect("call webhook repeat is ignored", await call(target, "/bolna/webhook/call", { body: payloads.bolnaCallStatus(callId, "completed"), headers: hookToken }), 200, '{"ok":true,"duplicate":true}');
  expect("call webhook with a wrong token is refused", await call(target, "/bolna/webhook/call", { body: payloads.bolnaCallStatus(callId, "failed"), headers: { "x-suvidha-token": "wrong" } }), 401);

  const tap = signed(payloads.textReply("Kal subah tak"));
  expect("WhatsApp reply is logged", await call(target, "/whatsapp/webhook", tap), 200, '{"ok":true}');
  expect("WhatsApp retry of the same message is ignored", await call(target, "/whatsapp/webhook", tap), 200, '{"ok":true,"duplicate":true}');
  expect("WhatsApp shortlist tap is logged", await call(target, "/whatsapp/webhook", signed(payloads.bookTap("ZZZZ"))), 200, '{"ok":true}');
  expect("WhatsApp event with a forged signature is refused", await call(target, "/whatsapp/webhook", { body: tap.body, headers: { "x-hub-signature-256": "sha256=forged" } }), 401);

  const verify = (token: string) => `/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(token)}&hub.challenge=4242`;
  expect("Meta handshake with the right token echoes the challenge", await call(target, verify(secrets.WHATSAPP_VERIFY_TOKEN)), 200, "4242");
  expect("Meta handshake with a wrong token is refused", await call(target, verify("wrong")), 403);

  return checks;
}
