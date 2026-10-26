import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string().min(1),
  RAILWAY_GIT_COMMIT_SHA: z.string().default("dev"),
  BOLNA_FUNCTION_TOKEN: z.string().min(16),
  BOLNA_WEBHOOK_TOKEN: z.string().min(16),
  WHATSAPP_APP_SECRET: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
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
