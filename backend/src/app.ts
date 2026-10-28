import express from "express";
import type { Config } from "./config.ts";
import type { SaveWebhook } from "./http/webhook-log.ts";
import { bolnaRouter } from "./routes/bolna.ts";
import { whatsappRouter } from "./routes/whatsapp.ts";
import type { Services } from "./services.ts";

export type AppDeps = {
  pingDb: () => Promise<unknown>;
  version: string;
  secrets: Pick<Config, "BOLNA_FUNCTION_TOKEN" | "BOLNA_WEBHOOK_TOKEN" | "WHATSAPP_APP_SECRET" | "WHATSAPP_VERIFY_TOKEN">;
  saveWebhook: SaveWebhook;
  services: Services;
  background: (task: () => Promise<void>) => void;
  log: (line: string) => void;
};

export function createApp(deps: AppDeps) {
  const app = express();

  app.get("/health", async (_req, res) => {
    const db = await deps.pingDb().then(
      () => "up" as const,
      () => "down" as const,
    );
    res.status(db === "up" ? 200 : 503).json({ ok: db === "up", db, version: deps.version });
  });

  app.use(
    "/bolna",
    bolnaRouter({
      functionToken: deps.secrets.BOLNA_FUNCTION_TOKEN,
      webhookToken: deps.secrets.BOLNA_WEBHOOK_TOKEN,
      saveWebhook: deps.saveWebhook,
      services: deps.services,
      background: deps.background,
      log: deps.log,
    }),
  );
  app.use(
    "/whatsapp",
    whatsappRouter({
      appSecret: deps.secrets.WHATSAPP_APP_SECRET,
      verifyToken: deps.secrets.WHATSAPP_VERIFY_TOKEN,
      saveWebhook: deps.saveWebhook,
      services: deps.services,
      background: deps.background,
    }),
  );

  return app;
}
