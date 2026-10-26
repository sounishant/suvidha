import postgres from "postgres";
import { z } from "zod";
import { readEnv } from "../../src/config.ts";

const TABLES = [
  "location_pings", "contacts", "bookings", "offers", "jobs", "worker_stats",
  "workers", "customers", "rate_card", "webhook_log", "schema_migrations",
];

export function testSql() {
  const env = readEnv(
    z.object({ TEST_DATABASE_URL: z.string().min(1), DATABASE_URL: z.string().optional() }),
    process.env,
  );
  // These tests drop every table, so never point them at the real database.
  if (env.TEST_DATABASE_URL === env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
  return postgres(env.TEST_DATABASE_URL, { onnotice: () => {} });
}

export async function resetDb(sql: postgres.Sql) {
  await sql.unsafe(`drop table if exists ${TABLES.join(", ")} cascade`);
}
