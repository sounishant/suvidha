import type { IncomingHttpHeaders } from "node:http";
import type { RequestHandler } from "express";
import { z } from "zod";

export type WebhookSource = "bolna_lookup" | "bolna_fn" | "bolna_call" | "whatsapp";

export type WebhookEntry = {
  source: WebhookSource;
  externalId: string | null;
  path: string;
  headers: Record<string, string | string[]>;
  body: string;
};

export type SaveWebhook = (entry: WebhookEntry) => Promise<"new" | "duplicate">;

const SECRET_HEADERS = new Set(["authorization", "x-suvidha-token"]);

function redact(headers: IncomingHttpHeaders) {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) out[name] = SECRET_HEADERS.has(name) ? "[redacted]" : value;
  }
  return out;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Bolna posts the same call once per status change, so a repeat is the same id + status.
export function bolnaCallId(body: unknown) {
  const call = z.object({ id: z.string(), status: z.string() }).safeParse(body);
  return call.success ? `${call.data.id}:${call.data.status}` : null;
}

const WhatsAppEnvelope = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            messages: z.array(z.object({ id: z.string() })).optional(),
            statuses: z.array(z.object({ id: z.string(), status: z.string() })).optional(),
          }),
        }),
      ),
    }),
  ),
});

export function whatsappIds(body: unknown) {
  const envelope = WhatsAppEnvelope.safeParse(body);
  if (!envelope.success) return null;
  const values = envelope.data.entry.flatMap((e) => e.changes.map((c) => c.value));
  const ids = values.flatMap((v) => [
    ...(v.messages ?? []).map((m) => m.id),
    ...(v.statuses ?? []).map((s) => `${s.id}:${s.status}`),
  ]);
  return ids.length ? ids.join(",") : null;
}

// Runs after the auth check, so strangers can't pre-claim a real message id and get it ignored.
export function logWebhook(
  save: SaveWebhook,
  source: WebhookSource,
  externalId: (body: unknown) => string | null = () => null,
): RequestHandler {
  return async (req, res, next) => {
    const body = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    const parsed = parseJson(body);
    const outcome = await save({ source, externalId: externalId(parsed), path: req.originalUrl, headers: redact(req.headers), body });
    if (outcome === "duplicate") {
      res.json({ ok: true, duplicate: true });
      return;
    }
    req.body = parsed;
    next();
  };
}
