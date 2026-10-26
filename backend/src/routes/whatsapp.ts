import express from "express";
import { requireWhatsAppSignature, sameSecret } from "../http/auth.ts";
import { logWebhook, whatsappIds, type SaveWebhook } from "../http/webhook-log.ts";

export function whatsappRouter(deps: { appSecret: string; verifyToken: string; saveWebhook: SaveWebhook }) {
  const router = express.Router();

  // Meta's one-time handshake when the webhook URL is registered.
  router.get("/webhook", (req, res) => {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
    if (mode === "subscribe" && typeof token === "string" && sameSecret(token, deps.verifyToken)) {
      res.type("text/plain").send(String(challenge ?? ""));
    } else {
      res.sendStatus(403);
    }
  });

  router.post(
    "/webhook",
    express.raw({ type: () => true, limit: "2mb" }),
    requireWhatsAppSignature(deps.appSecret),
    logWebhook(deps.saveWebhook, "whatsapp", whatsappIds),
    (_req, res) => {
      res.json({ ok: true });
    },
  );

  return router;
}
