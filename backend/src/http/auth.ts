import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

// Hashing first gives equal-length buffers, so the compare leaks neither content nor length.
export function sameSecret(given: string, expected: string) {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function whatsappSignature(appSecret: string, rawBody: Buffer | string) {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}

function unauthorized(res: Parameters<RequestHandler>[1]) {
  res.status(401).json({ ok: false, error: "unauthorized" });
}

export function requireBearer(token: string): RequestHandler {
  return (req, res, next) => (sameSecret(req.get("authorization") ?? "", `Bearer ${token}`) ? next() : unauthorized(res));
}

export function requireHeader(name: string, token: string): RequestHandler {
  return (req, res, next) => (sameSecret(req.get(name) ?? "", token) ? next() : unauthorized(res));
}

// Must run after express.raw: Meta signs the exact bytes it sent.
export function requireWhatsAppSignature(appSecret: string): RequestHandler {
  return (req, res, next) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    return sameSecret(req.get("x-hub-signature-256") ?? "", whatsappSignature(appSecret, raw)) ? next() : unauthorized(res);
  };
}
