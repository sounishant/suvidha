import { z } from "zod";
import { readEnv } from "../src/config.ts";
import { runWebhookChecks } from "./webhook-checks.ts";

const env = readEnv(
  z.object({
    SIM_BASE_URL: z.string().default("http://localhost:8080"),
    BOLNA_FUNCTION_TOKEN: z.string().min(1),
    BOLNA_WEBHOOK_TOKEN: z.string().min(1),
    WHATSAPP_APP_SECRET: z.string().min(1),
    WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  }),
  process.env,
);

console.log(`Simulating against ${env.SIM_BASE_URL}\n`);
const checks = await runWebhookChecks({ baseUrl: env.SIM_BASE_URL, secrets: env });
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.pass ? "" : `  (got ${c.detail})`}`);

const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exitCode = failed ? 1 : 0;
