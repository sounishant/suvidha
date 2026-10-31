import type { Sql } from "postgres";
import { bolnaApi, offlineBolna } from "./clients/bolna.ts";
import { ROORKEE, googleMaps, offlineMaps } from "./clients/maps.ts";
import { fakePayments } from "./clients/payments.ts";
import { offlineStorage, supabaseStorage } from "./clients/storage.ts";
import { cloudWhatsApp, offlineWhatsApp } from "./clients/whatsapp.ts";
import type { Config } from "./config.ts";
import type { Ctx } from "./core/context.ts";

export function buildCtx(config: Config, sql: Sql, log: (line: string) => void): Ctx {
  const whatsapp =
    config.WHATSAPP_ACCESS_TOKEN && config.WHATSAPP_PHONE_NUMBER_ID
      ? cloudWhatsApp({
          accessToken: config.WHATSAPP_ACCESS_TOKEN,
          phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID,
          apiVersion: config.WHATSAPP_API_VERSION,
        })
      : offlineWhatsApp(log, config.RAILWAY_GIT_COMMIT_SHA === "dev");
  const customerLine =
    config.BOLNA_AGENT_ID_CUSTOMER && config.BOLNA_CUSTOMER_LINE_NUMBER
      ? { agentId: config.BOLNA_AGENT_ID_CUSTOMER, number: config.BOLNA_CUSTOMER_LINE_NUMBER }
      : null;
  // While testing with one number, worker calls go out from the customer line.
  const workerNumber = config.BOLNA_WORKER_LINE_NUMBER ?? config.BOLNA_CUSTOMER_LINE_NUMBER;
  const workerLine = config.BOLNA_AGENT_ID_WORKER && workerNumber ? { agentId: config.BOLNA_AGENT_ID_WORKER, number: workerNumber } : null;

  return {
    sql,
    whatsapp,
    bolna: config.BOLNA_API_KEY ? bolnaApi(config.BOLNA_API_KEY) : offlineBolna(log),
    storage:
      config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY
        ? supabaseStorage({ url: config.SUPABASE_URL, serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY })
        : offlineStorage(log),
    maps: config.GOOGLE_MAPS_API_KEY ? googleMaps(config.GOOGLE_MAPS_API_KEY, ROORKEE) : offlineMaps(log),
    payments: fakePayments(config.BACKEND_PUBLIC_URL ?? `http://localhost:${config.PORT}`, log),
    customerLine,
    workerLine,
    customerLineMode: config.CUSTOMER_LINE_MODE,
    limits: {
      inviteDelaySec: config.INVITE_DELAY_SEC,
      parallelCalls: config.PARALLEL_CALLS,
      maxWorkerCalls: config.MAX_WORKER_CALLS,
      quotesWanted: config.QUOTES_WANTED,
      callTimeoutSec: config.CALL_TIMEOUT_SEC,
      extractionWaitSec: config.EXTRACTION_WAIT_SEC,
      paymentWindowSec: config.PAYMENT_WINDOW_SEC,
    },
    now: () => new Date(),
    log,
    background: (task) => {
      task().catch((err: Error) => log(`background task failed: ${err.stack ?? err}`));
    },
  };
}
