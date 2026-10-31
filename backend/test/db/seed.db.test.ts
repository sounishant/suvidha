import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { seed, seedWorkers } from "../../src/db/seed.ts";
import { resetDb, testSql } from "./helpers.ts";

const sql = testSql();
const phones = ["+919000000001", "+919000000002", "+919000000003"];

beforeAll(async () => {
  await resetDb(sql);
  await migrate(sql);
});
afterAll(() => sql.end());

describe("migrate + seed", () => {
  it("can run twice without duplicating anything", async () => {
    await seed(sql, phones);
    await seed(sql, phones);

    const [counts] = await sql`
      select (select count(*)::int from workers)      as workers,
             (select count(*)::int from worker_stats) as stats`;
    expect(counts).toEqual({ workers: 3, stats: seedWorkers(phones).flatMap((w) => w.skills).length * 4 });
  });

  it("stores worker checks as a JSON object, not a JSON string", async () => {
    const rows = await sql`select jsonb_typeof(checks) as kind, checks->>'id' as id from workers`;
    expect(rows.every((r) => r.kind === "object" && r.id === "true")).toBe(true);
  });

  it("re-running migrate applies nothing new", async () => {
    const before = await sql`select name from schema_migrations`;
    await migrate(sql);
    expect(await sql`select name from schema_migrations`).toEqual(before);
  });
});
