import { readdir, readFile } from "node:fs/promises";
import postgres, { type Sql } from "postgres";
import { z } from "zod";
import { readEnv } from "../config.ts";

const dir = new URL("./migrations/", import.meta.url);

export async function migrate(sql: Sql, log: (line: string) => void = () => {}) {
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
    log(`applied ${name}`);
  }
  log(`database up to date (${files.length} migration files)`);
}

if (import.meta.main) {
  const { DATABASE_URL } = readEnv(z.object({ DATABASE_URL: z.string().min(1) }), process.env);
  const sql = postgres(DATABASE_URL);
  await migrate(sql, console.log);
  await sql.end();
}
