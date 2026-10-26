import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string().min(1),
  RAILWAY_GIT_COMMIT_SHA: z.string().default("dev"),
});

export type Config = z.infer<typeof Env>;

// `.env` uses NULL for "not filled in yet", so it counts as missing.
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const filled = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value !== "" && value !== "NULL"),
  );
  return Env.parse(filled);
}
