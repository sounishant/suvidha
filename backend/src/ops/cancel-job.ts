import postgres from "postgres";
import { loadConfig } from "../config.ts";
import { suvidhaCancels } from "../core/cancellations.ts";
import { buildCtx } from "../wiring.ts";

// npm run cancel-job -- <job ref>: the team cancels a job; a paid booking is refunded in full plus apology credit.
const ref = process.argv[2]?.toUpperCase();
if (!ref) throw new Error("usage: npm run cancel-job -- <job ref>");
const config = loadConfig(process.env);
const sql = postgres(config.DATABASE_URL);
const ctx = buildCtx(config, sql, console.log);
console.log((await suvidhaCancels(ctx, ref)) ? `job ${ref} cancelled` : `job ${ref} not found, or not open`);
await sql.end();
