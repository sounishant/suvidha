import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { isSandbox } from "../core/phone.ts";
import type { BolnaClient } from "./bolna.ts";
import type { WhatsAppClient } from "./whatsapp.ts";

// Messages to demo numbers go to demo_messages, which the website's phone shows, instead of to Meta.
export function sandboxWhatsApp(real: WhatsAppClient, sql: Sql): WhatsAppClient {
  const keep = async (to: string, kind: string, body: object) => {
    await sql`insert into demo_messages (phone, kind, body) values (${`+${to.replace(/^\+/, "")}`}, ${kind}, ${sql.json(body as never)})`;
    return `demo.${randomUUID()}`;
  };
  return {
    sendText: (to, text) => (isSandbox(to) ? keep(to, "text", { text }) : real.sendText(to, text)),
    sendButtons: (to, text, buttons) => (isSandbox(to) ? keep(to, "buttons", { text, buttons }) : real.sendButtons(to, text, buttons)),
    sendList: (to, list) => (isSandbox(to) ? keep(to, "list", list) : real.sendList(to, list)),
    sendImage: (to, link, caption) => (isSandbox(to) ? keep(to, "image", { link, caption }) : real.sendImage(to, link, caption)),
    downloadMedia: (mediaId) => real.downloadMedia(mediaId),
  };
}

// Demo workers are never rung; answerSandboxCalls quotes for them from the tick loop.
export function sandboxBolna(real: BolnaClient): BolnaClient {
  return {
    call: async (req) => (isSandbox(req.to) ? `sandbox-${randomUUID()}` : real.call(req)),
    webSession: (agentId, userData) => real.webSession(agentId, userData),
  };
}
