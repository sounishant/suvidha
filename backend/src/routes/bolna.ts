import express, { type RequestHandler } from "express";
import { requireBearer, requireHeader } from "../http/auth.ts";
import { bolnaCallId, logWebhook, type SaveWebhook } from "../http/webhook-log.ts";

const FUNCTIONS = ["create_job", "report_prank", "register_worker", "respond_to_offer"];

const notImplemented: RequestHandler = (_req, res) => {
  res.status(501).json({ ok: false, error: "not_implemented", detail: "This function is not built yet." });
};

export function bolnaRouter(deps: { functionToken: string; webhookToken: string; saveWebhook: SaveWebhook }) {
  const router = express.Router();
  const raw = express.raw({ type: () => true, limit: "2mb" });
  const fnAuth = requireBearer(deps.functionToken);

  router.get(["/lookup/customer", "/lookup/worker"], fnAuth, logWebhook(deps.saveWebhook, "bolna_lookup"), notImplemented);
  router.post(FUNCTIONS.map((name) => `/fn/${name}`), raw, fnAuth, logWebhook(deps.saveWebhook, "bolna_fn"), notImplemented);
  router.post(
    "/webhook",
    raw,
    requireHeader("x-suvidha-token", deps.webhookToken),
    logWebhook(deps.saveWebhook, "bolna_call", bolnaCallId),
    (_req, res) => {
      res.json({ ok: true });
    },
  );

  return router;
}
