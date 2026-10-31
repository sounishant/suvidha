import type { Sql, TransactionSql } from "postgres";

export type EventType =
  | "call_ended" | "extraction_done" | "followup_sent" | "followup_answered" | "status_changed"
  | "worker_invited" | "quote_received" | "message_sent" | "booking_made" | "safety_note_recorded"
  | "priority_question_asked" | "card_updated" | "trip_started" | "job_started" | "job_done" | "job_closed"
  | "payment_requested" | "payment_expired" | "booking_cancelled";

export async function logEvent(
  sql: Sql | TransactionSql,
  jobId: string | null,
  type: EventType,
  actor: string,
  details: Record<string, unknown> = {},
) {
  await sql`insert into events (job_id, event_type, actor, details) values (${jobId}, ${type}, ${actor}, ${sql.json(details as never)})`;
}
