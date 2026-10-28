import postgres from "postgres";
import { z } from "zod";
import { readEnv } from "../../src/config.ts";

// Tests drop everything they create, so they live in their own schema and never touch the app's tables in public.
const SCHEMA = "suvidha_test";

export function testSql() {
  const { TEST_DATABASE_URL } = readEnv(z.object({ TEST_DATABASE_URL: z.string().min(1) }), process.env);
  return postgres(TEST_DATABASE_URL, { connection: { search_path: SCHEMA }, onnotice: () => {} });
}

export async function resetDb(sql: postgres.Sql) {
  await sql.unsafe(`drop schema if exists ${SCHEMA} cascade; create schema ${SCHEMA}`);
}
