import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { whatsappText } from "../messages.ts";
import type { Ctx } from "./context.ts";
import { maskPhone, toE164, toWhatsApp } from "./phone.ts";

export type Role = "customer" | "worker";
export type Session = { id: string; phone: string; role: Role; customerId: string | null; workerId: string | null };
export type LoginReply = { ok: true } | { ok: false; error: "invalid_phone" | "too_many_codes" | "wrong_code" };

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const CODES_PER_WINDOW = 3;
const WINDOW_MINUTES = 15;
const FAILED_PER_DAY = 15;
const SESSION_DAYS = 30;

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const codeHash = (phone: string, code: string) => sha256(`${phone}:${code}`);
const sameHash = (a: string, b: string) => timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

type Account = { id: string; language: string | null; name: string | null };

async function accountFor(sql: Sql | TransactionSql, phone: string, role: Role): Promise<Account | null> {
  const rows =
    role === "customer"
      ? await sql<Account[]>`select id, preferred_language as language, name from customers where phone = ${phone} and not blocked`
      : await sql<Account[]>`select id, language, name from workers where phone = ${phone} and not blocked`;
  return rows[0] ?? null;
}

// Customers can sign up here, so any valid number gets a code; workers still join only by calling,
// and for them the reply and the rate limit stay the same whether or not the number is known.
export async function startLogin(ctx: Ctx, input: { phone: string; role: Role }): Promise<LoginReply> {
  const phone = toE164(input.phone);
  if (!/^\+91\d{10}$/.test(phone)) return { ok: false, error: "invalid_phone" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // The lock makes count-then-insert atomic per phone; the daily cap bounds guessing across many codes.
  const issued = await ctx.sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${phone}))`;
    const [used] = await tx<{ recent: number; failed: number }[]>`
      select count(*) filter (where created_at > now() - make_interval(mins => ${WINDOW_MINUTES}))::int as recent,
             coalesce(sum(attempts), 0)::int as failed
      from login_codes where phone = ${phone} and created_at > now() - interval '1 day'`;
    if (used!.recent >= CODES_PER_WINDOW || used!.failed >= FAILED_PER_DAY) return false;
    await tx`
      insert into login_codes (phone, role, code_hash, expires_at)
      values (${phone}, ${input.role}, ${codeHash(phone, code)}, now() + make_interval(mins => ${CODE_MINUTES}))`;
    return true;
  });
  if (!issued) return { ok: false, error: "too_many_codes" };

  const account = await accountFor(ctx.sql, phone, input.role);
  if (!account && input.role === "worker") {
    ctx.log(`login code asked for unknown worker ${maskPhone(phone)}`);
    return { ok: true };
  }
  ctx.background(async () => {
    await ctx.whatsapp.sendText(toWhatsApp(phone), whatsappText(account?.language, "login_code", { code }));
  });
  return { ok: true };
}

export async function verifyLogin(
  ctx: Ctx,
  input: { phone: string; role: Role; code: string },
): Promise<{ ok: true; token: string; role: Role; needsName: boolean } | { ok: false; error: "wrong_code" }> {
  const phone = toE164(input.phone);
  return ctx.sql.begin(async (tx) => {
    const [row] = await tx<{ id: string; code_hash: string; attempts: number }[]>`
      select id, code_hash, attempts from login_codes
      where phone = ${phone} and role = ${input.role} and used_at is null and expires_at > now()
      order by created_at desc limit 1 for update`;
    if (!row || row.attempts >= MAX_ATTEMPTS) return { ok: false as const, error: "wrong_code" as const };
    if (!/^\d{6}$/.test(input.code) || !sameHash(row.code_hash, codeHash(phone, input.code))) {
      await tx`update login_codes set attempts = attempts + 1 where id = ${row.id}`;
      return { ok: false as const, error: "wrong_code" as const };
    }
    // A first-time customer becomes one here; the call flow later finds them by phone.
    if (input.role === "customer") await tx`insert into customers (phone) values (${phone}) on conflict (phone) do nothing`;
    const account = await accountFor(tx, phone, input.role);
    if (!account) return { ok: false as const, error: "wrong_code" as const };

    await tx`update login_codes set used_at = now() where id = ${row.id}`;
    const token = randomBytes(32).toString("base64url");
    await tx`
      insert into sessions (token_hash, phone, role, customer_id, worker_id, expires_at)
      values (${sha256(token)}, ${phone}, ${input.role},
              ${input.role === "customer" ? account.id : null}, ${input.role === "worker" ? account.id : null},
              now() + make_interval(days => ${SESSION_DAYS}))`;
    return { ok: true as const, token, role: input.role, needsName: !account.name };
  });
}

export async function sessionFor(ctx: Ctx, token: string): Promise<Session | null> {
  const [row] = await ctx.sql<{ id: string; phone: string; role: Role; customer_id: string | null; worker_id: string | null }[]>`
    select s.id, s.phone, s.role, s.customer_id, s.worker_id from sessions s
    left join customers c on c.id = s.customer_id
    left join workers w on w.id = s.worker_id
    where s.token_hash = ${sha256(token)} and s.revoked_at is null and s.expires_at > now()
      and not coalesce(c.blocked, w.blocked, false)`;
  return row ? { id: row.id, phone: row.phone, role: row.role, customerId: row.customer_id, workerId: row.worker_id } : null;
}

export async function endSession(ctx: Ctx, sessionId: string) {
  await ctx.sql`update sessions set revoked_at = now() where id = ${sessionId}`;
}
