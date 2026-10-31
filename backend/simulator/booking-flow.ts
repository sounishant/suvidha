import { randomInt, randomUUID } from "node:crypto";
import { whatsappSignature } from "../src/http/auth.ts";
import * as payloads from "./payloads.ts";
import type { Check, Target } from "./webhook-checks.ts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Intake calls end, the job card is built from the extraction, and the caller hears about it next time.
// Fresh fake numbers each run keep it clear of the daily call limit; worker calls are covered by the DB tests.
export async function runBookingFlow(target: Target): Promise<Check[]> {
  const checks: Check[] = [];
  const check = (name: string, pass: boolean, detail: unknown) => checks.push({ name, pass, detail: JSON.stringify(detail).slice(0, 160) });
  const bearer = { authorization: `Bearer ${target.secrets.BOLNA_FUNCTION_TOKEN}`, "content-type": "application/json" };
  const hook = { "x-suvidha-token": target.secrets.BOLNA_WEBHOOK_TOKEN, "content-type": "application/json" };
  const fakePhone = () => `+911${String(randomInt(1e8, 1e9))}`;

  const lookup = async (phone: string) =>
    (await (await fetch(`${target.baseUrl}/bolna/lookup/customer?contact_number=${encodeURIComponent(phone)}&execution_id=${randomUUID()}`, { headers: bearer })).json()) as Record<string, string>;
  const callEnded = (callerRef: string, card: Record<string, string>) =>
    fetch(`${target.baseUrl}/bolna/webhook/call`, { method: "POST", headers: hook, body: JSON.stringify(payloads.customerCallEnded(randomUUID(), callerRef, card)) });
  const whatsapp = (body: object) => {
    const raw = JSON.stringify(body);
    return fetch(`${target.baseUrl}/whatsapp/webhook`, {
      method: "POST", body: raw,
      headers: { "content-type": "application/json", "x-hub-signature-256": whatsappSignature(target.secrets.WHATSAPP_APP_SECRET, raw) },
    });
  };

  const phone = fakePhone();
  const first = await lookup(phone);
  check("new caller gets a 4-character caller code", first.caller_type === "new" && /^[A-Z2-9]{4}$/.test(first.caller_ref ?? ""), first);

  const ended = await callEnded(first.caller_ref!, payloads.jobCard());
  check("intake call webhook with the job card is accepted", ended.status === 200, ended.status);
  await wait(2000);

  const back = await lookup(phone);
  check("a complete card goes to workers: the caller hears rates are being collected", (back.open_job ?? "").includes("rate"), back);

  const reply = await whatsapp(payloads.textReply("Gate pe naam likhwana padta hai", phone.slice(1)));
  check("a WhatsApp change after the call is accepted", reply.status === 200, reply.status);

  const draftPhone = fakePhone();
  const draftCaller = await lookup(draftPhone);
  await callEnded(draftCaller.caller_ref!, payloads.jobCard({ time_window: "", priority_first: "" }));
  await wait(2000);
  const draft = await lookup(draftPhone);
  check("a card missing fields stays a draft and the caller is pointed to WhatsApp", (draft.open_job ?? "").includes("WhatsApp"), draft);

  const tap = await whatsapp(payloads.bookTap("ZZZZ", draftPhone.slice(1)));
  check("a shortlist tap for an unknown quote is ignored safely", tap.status === 200, tap.status);

  const pay = await fetch(`${target.baseUrl}/pay/${randomUUID()}`);
  check("an unknown payment link shows not found", pay.status === 404, pay.status);

  return checks;
}
