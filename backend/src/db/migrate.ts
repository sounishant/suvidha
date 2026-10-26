import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";
import { loadConfig } from "../config.ts";

const config = loadConfig(process.env);
const sql = postgres(config.DATABASE_URL);
const dir = new URL("./migrations/", import.meta.url);

await sql`
  create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;

const applied = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

for (const name of files) {
  if (applied.has(name)) continue;
  const text = await readFile(new URL(name, dir), "utf8");
  // Our own migration files, never user input, so running raw SQL is safe here.
  await sql.begin(async (tx) => {
    await tx.unsafe(text);
    await tx`insert into schema_migrations (name) values (${name})`;
  });
  console.log(`applied ${name}`);
}

console.log(`database up to date (${files.length} migration files)`);
await sql.end();
