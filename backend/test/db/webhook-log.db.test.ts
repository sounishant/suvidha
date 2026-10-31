import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { saveWebhook } from "../../src/db/webhook-log.ts";
import { resetDb, testSql } from "./helpers.ts";

const sql = testSql();
const save = saveWebhook(sql);
const entry = { source: "whatsapp" as const, path: "/whatsapp/webhook", headers: { "x-hub-signature-256": "sha256=ab" }, body: "{}" };

beforeAll(async () => {
  await resetDb(sql);
  await migrate(sql);
});
afterAll(() => sql.end());

describe("saveWebhook", () => {
  it("stores the first copy and reports repeats as duplicates", async () => {
    expect(await save({ ...entry, externalId: "wamid.1" })).toBe("new");
    expect(await save({ ...entry, externalId: "wamid.1" })).toBe("duplicate");
    expect(await save({ ...entry, source: "bolna_call", externalId: "wamid.1" })).toBe("new");
  });

  it("never dedups rows without an external id", async () => {
    expect(await save({ ...entry, source: "bolna_fn", externalId: null })).toBe("new");
    expect(await save({ ...entry, source: "bolna_fn", externalId: null })).toBe("new");
  });

  it("keeps headers as JSON and the body as raw text", async () => {
    const [row] = await sql`select headers, body from webhook_log where external_id = 'wamid.1' and source = 'whatsapp'`;
    expect(row).toEqual({ headers: entry.headers, body: "{}" });
  });
});
