import type { AddressInfo } from "node:net";
import { createApp, type AppDeps } from "../src/app.ts";
import type { SaveWebhook, WebhookEntry } from "../src/http/webhook-log.ts";

export const secrets = {
  BOLNA_FUNCTION_TOKEN: "test-function-token-0123456789",
  BOLNA_WEBHOOK_TOKEN: "test-webhook-token-0123456789",
  WHATSAPP_APP_SECRET: "test-app-secret",
  WHATSAPP_VERIFY_TOKEN: "test-verify-token",
};

// Same dedup rule as the webhook_log unique index.
export function memoryWebhookLog() {
  const entries: WebhookEntry[] = [];
  const seen = new Set<string>();
  const save: SaveWebhook = async (e) => {
    if (e.externalId !== null) {
      const key = `${e.source}:${e.externalId}`;
      if (seen.has(key)) return "duplicate";
      seen.add(key);
    }
    entries.push(e);
    return "new";
  };
  return { entries, save };
}

export function startApp(overrides: Partial<AppDeps> = {}) {
  const log = memoryWebhookLog();
  const app = createApp({ pingDb: async () => 1, version: "test", secrets, saveWebhook: log.save, ...overrides });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, log, close: () => server.close() };
}
