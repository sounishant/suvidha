import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string().min(1),
  RAILWAY_GIT_COMMIT_SHA: z.string().default("dev"),
  BOLNA_FUNCTION_TOKEN: z.string().min(16),
  BOLNA_WEBHOOK_TOKEN: z.string().min(16),
  WHATSAPP_APP_SECRET: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  // Shared with the Next.js server, the only caller of /app.
  APP_API_TOKEN: z.string().min(16),
  TICK_SEC: z.coerce.number().positive().default(3),
  INVITE_DELAY_SEC: z.coerce.number().int().nonnegative().default(60),
  PARALLEL_CALLS: z.coerce.number().int().positive().default(2),
  MAX_WORKER_CALLS: z.coerce.number().int().positive().default(4),
  QUOTES_WANTED: z.coerce.number().int().positive().default(3),
  CALL_TIMEOUT_SEC: z.coerce.number().int().positive().default(300),
  EXTRACTION_WAIT_SEC: z.coerce.number().int().positive().default(120),
  // "test": no daily call limit or auto-flagging, and workers calling the customer line book as customers.
  CUSTOMER_LINE_MODE: z.enum(["live", "test"]).default("live"),
  PAYMENT_WINDOW_SEC: z.coerce.number().int().positive().default(300),
  BACKEND_PUBLIC_URL: z.url().optional(),
  // Outbound keys arrive with the phone numbers; until then the clients only log.
  BOLNA_API_KEY: z.string().optional(),
  BOLNA_AGENT_ID_CUSTOMER: z.string().optional(),
  BOLNA_CUSTOMER_LINE_NUMBER: z.string().optional(),
  BOLNA_AGENT_ID_WORKER: z.string().optional(),
  BOLNA_WORKER_LINE_NUMBER: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v26.0"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

export type Config = z.infer<typeof Env>;

// `.env` uses NULL for "not filled in yet", so it counts as missing.
export function readEnv<T extends z.ZodType>(schema: T, env: NodeJS.ProcessEnv): z.infer<T> {
  const filled = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value !== "" && value !== "NULL"),
  );
  return schema.parse(filled);
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return readEnv(Env, env);
}
