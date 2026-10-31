import type { Sql } from "postgres";
import type { SaveWebhook } from "../http/webhook-log.ts";

export function saveWebhook(sql: Sql): SaveWebhook {
  return async (e) => {
    const rows = await sql`
      insert into webhook_log (source, external_id, path, headers, body)
      values (${e.source}, ${e.externalId}, ${e.path}, ${sql.json(e.headers)}, ${e.body})
      on conflict (source, external_id) where external_id is not null do nothing
      returning id`;
    return rows.length ? "new" : "duplicate";
  };
}
