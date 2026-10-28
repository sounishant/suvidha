import postgres from "postgres";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { expireQuoteCalls, startDueInvites } from "./core/quotes.ts";
import { saveWebhook } from "./db/webhook-log.ts";
import { coreServices } from "./services.ts";
import { buildCtx } from "./wiring.ts";

const config = loadConfig(process.env);
const sql = postgres(config.DATABASE_URL);
const ctx = buildCtx(config, sql, console.log);

const app = createApp({
  pingDb: () => sql`select 1`,
  version: config.RAILWAY_GIT_COMMIT_SHA,
  secrets: config,
  saveWebhook: saveWebhook(sql),
  services: coreServices(ctx),
  background: ctx.background,
  log: ctx.log,
});

// Timers live in the database (next_action_at); this loop only acts on whatever is overdue.
let ticking = false;
setInterval(() => {
  if (ticking) return;
  ticking = true;
  Promise.all([startDueInvites(ctx), expireQuoteCalls(ctx)])
    .catch((err: Error) => console.error(`tick failed: ${err.message}`))
    .finally(() => (ticking = false));
}, config.TICK_SEC * 1000);

app.listen(config.PORT, () => {
  console.log(`Suvidha backend listening on port ${config.PORT}`);
});
