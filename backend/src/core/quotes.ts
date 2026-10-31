import { distanceKm } from "../clients/maps.ts";
import type { ListMessage } from "../clients/whatsapp.ts";
import { label, priceLabel, tradeName, whatsappText, whenLabel } from "../messages.ts";
import type { WorkerQuote } from "./card.ts";
import type { Ctx } from "./context.ts";
import { logEvent } from "./events.ts";
import { bookingFee, NO_SHOW_CALL_LAST_DAYS } from "./fees.ts";
import { jobById, jobLabel, moveJob, photoLink, recordSent, whenText, type JobRow } from "./jobs.ts";
import { isSandbox, SANDBOX_PREFIX, toWhatsApp } from "./phone.ts";
import { rankQuotes, type Measure, type RankedQuote } from "./ranking.ts";
import { withFreshRef } from "./refs.ts";

type Candidate = { id: string; name: string; phone: string; language: string; distanceKm: number | null; skilled: boolean; noShow: boolean };

// Right skill first, then nearest; workers without a location, or who skipped a booking lately, go last.
// Website demo jobs reach only demo workers, and real jobs never do.
async function candidates(ctx: Ctx, job: JobRow): Promise<Candidate[]> {
  const noShowSince = new Date(ctx.now().getTime() - NO_SHOW_CALL_LAST_DAYS * 86_400_000);
  const rows = await ctx.sql<{ id: string; name: string; phone: string; language: string; lat: number | null; lng: number | null; skilled: boolean; noShow: boolean }[]>`
    select w.id, w.name, w.phone, w.language, w.lat, w.lng, (${job.job_type} = any(w.skills)) as skilled,
           coalesce(w.last_no_show_at > ${noShowSince}, false) as "noShow"
    from workers w
    where w.verified and not w.blocked and ${job.trade} = any(w.trades)
      and starts_with(w.phone, ${SANDBOX_PREFIX}) = ${isSandbox(job.phone)}
      and not exists (select 1 from quotes q where q.job_id = ${job.id} and q.worker_id = w.id)`;
  const here = job.lat !== null && job.lng !== null ? { lat: job.lat, lng: job.lng } : null;
  return rows
    .map(({ lat, lng, ...w }) => ({ ...w, distanceKm: here && lat !== null && lng !== null ? distanceKm(here, { lat, lng }) : null }))
    .sort((a, b) => Number(a.noShow) - Number(b.noShow) || Number(b.skilled) - Number(a.skilled) || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

export async function startInviting(ctx: Ctx, jobId: string) {
  const moved = await ctx.sql.begin(async (tx) => {
    if (!(await moveJob(tx, jobId, "confirmed", "inviting"))) return false;
    await tx`update jobs set invited_at = now(), next_action_at = null where id = ${jobId}`;
    return true;
  });
  if (moved) await advance(ctx, jobId);
}

// Called after anything that changes a job's calls: places the next calls or, when calling is over, sends the shortlist.
export async function advance(ctx: Ctx, jobId: string) {
  const { limits } = ctx;
  const plan = await ctx.sql.begin(async (tx) => {
    const [locked] = await tx<{ status: string }[]>`select status from jobs where id = ${jobId} for update`;
    if (locked?.status !== "inviting") return null;
    const [counts] = await tx<{ placed: number; active: number; quoted: number }[]>`
      select count(*)::int as placed,
             count(*) filter (where call_status = 'calling' or (call_status = 'answered' and quoted_at is null and next_action_at is not null))::int as active,
             count(*) filter (where available and price_type is not null)::int as quoted
      from quotes where job_id = ${jobId}`;
    const { placed, active, quoted } = counts!;
    if (quoted >= limits.quotesWanted) return { finish: true, calls: [] };

    const job = await jobById(tx, jobId);
    const room = Math.min(limits.parallelCalls - active, limits.maxWorkerCalls - placed);
    const next = room > 0 ? (await candidates(ctx, job)).slice(0, room) : [];
    if (!next.length) return { finish: active === 0, calls: [] };

    const calls = [];
    for (const [i, w] of next.entries()) {
      const quote = await withFreshRef(async (ref) => {
        const [row] = await tx<{ id: string; ref: string }[]>`
          insert into quotes (ref, job_id, worker_id, call_order, distance_km, next_action_at)
          values (${ref}, ${jobId}, ${w.id}, ${placed + i + 1}, ${w.distanceKm}, ${new Date(ctx.now().getTime() + limits.callTimeoutSec * 1000)})
          returning id, ref`;
        return row!;
      });
      calls.push({ quote, worker: w });
    }
    return { finish: false, calls, job };
  });

  if (!plan) return;
  if (plan.finish) return finish(ctx, jobId);
  for (const call of plan.calls) await callWorker(ctx, plan.job!, call.quote, call.worker);
}

// What a worker may see before quoting: area only, never the address, phone or budget.
function workerJobCard(job: JobRow, w: Pick<Candidate, "language" | "distanceKm">, now: Date) {
  const lang = w.language;
  return whatsappText(lang, "worker_job_card", {
    job: jobLabel({ ...job, language: lang }),
    problem: job.problem ?? "",
    locality: job.locality ?? whatsappText(lang, "none"),
    distance: w.distanceKm === null ? "" : whatsappText(lang, "distance", { km: Math.max(1, Math.round(w.distanceKm)) }),
    when: whenText({ ...job, language: lang }, now),
    material: job.material ? label(lang, "material", job.material) : whatsappText(lang, "none"),
    safety: job.safety_note ? whatsappText(lang, "safety_line", { note: job.safety_note }) : "",
  });
}

async function callWorker(ctx: Ctx, job: JobRow, quote: { id: string; ref: string }, w: Candidate) {
  const now = ctx.now();
  try {
    const card = workerJobCard(job, w, now);
    const link = await photoLink(ctx, job.photo_url);
    if (link) await ctx.whatsapp.sendImage(toWhatsApp(w.phone), link, card);
    else await ctx.whatsapp.sendText(toWhatsApp(w.phone), card);
  } catch (err) {
    ctx.log(`job card to worker for job ${job.ref} failed: ${(err as Error).message}`);
  }

  if (!ctx.workerLine) {
    ctx.log(`no worker line set up yet; quote ${quote.ref} for job ${job.ref} not called`);
    return missed(ctx, job.id, quote.id);
  }
  const lang = w.language;
  const distance = w.distanceKm === null ? "" : `${Math.max(1, Math.round(w.distanceKm))} km`;
  try {
    const executionId = await ctx.bolna.call({
      agentId: ctx.workerLine.agentId,
      from: ctx.workerLine.number,
      to: w.phone,
      // Every prompt variable is sent, empty when unused; job_* repeat them under the names the current prompt uses.
      userData: {
        call_type: "quote", offer_ref: quote.ref, worker_name: w.name, user_name: w.name,
        trade: tradeName(lang, job.trade), job_trade: tradeName(lang, job.trade),
        job_type: jobLabel({ ...job, language: lang }), problem: job.problem ?? "",
        material: job.material ? label(lang, "material", job.material) : "",
        area: job.locality ?? "", job_location: job.locality ?? "", distance_text: distance, job_distance: distance,
        time_window: whenText({ ...job, language: lang }, now), safety_note: job.safety_note ?? "",
        has_photo: job.photo_url ? "yes" : "no", job_price: "",
      },
    });
    await ctx.sql.begin(async (tx) => {
      await tx`update quotes set bolna_execution_id = ${executionId} where id = ${quote.id}`;
      await tx`
        insert into contacts (job_id, person_kind, person_phone, channel, direction, agent_or_template, bolna_execution_id, status)
        values (${job.id}, 'worker', ${w.phone}, 'voice', 'outbound', 'worker:quote', ${executionId}, 'queued')`;
      await logEvent(tx, job.id, "worker_invited", "system", { worker_id: w.id, quote: quote.ref });
    });
  } catch (err) {
    ctx.log(`call for quote ${quote.ref} failed: ${(err as Error).message}`);
    await missed(ctx, job.id, quote.id);
  }
}

async function missed(ctx: Ctx, jobId: string, quoteId: string) {
  await ctx.sql`update quotes set call_status = 'no_answer', next_action_at = null where id = ${quoteId}`;
  ctx.background(() => advance(ctx, jobId));
}

const UNANSWERED = new Set(["no-answer", "busy", "failed", "canceled", "error", "balance-low", "stopped"]);

// One webhook per call status; the quote itself arrives in the extraction, possibly on a later webhook.
export async function recordWorkerCall(
  ctx: Ctx,
  quote: { id: string; job_id: string; worker_id: string },
  call: { status: string; durationSec: number | null; quote: WorkerQuote | null },
) {
  if (call.quote?.available !== null && call.quote?.available !== undefined) {
    const q = call.quote;
    const updated = await ctx.sql`
      update quotes set call_status = 'answered', next_action_at = null, quoted_at = coalesce(quoted_at, now()),
        available = ${q.available}, decline_reason = ${q.declineReason}, price_type = ${q.priceType},
        price = ${q.price}, visit_charge = ${q.visitCharge},
        material_included = ${q.materialIncluded}, earliest_arrival = ${q.earliestArrival},
        duration_mins = ${q.durationMins}, note = ${q.note}
      where id = ${quote.id} and quoted_at is null
      returning id`;
    if (updated.length) {
      await logEvent(ctx.sql, quote.job_id, "quote_received", `worker ${quote.worker_id}`, { available: q.available, price_type: q.priceType });
      await advance(ctx, quote.job_id);
    }
    return;
  }
  if (UNANSWERED.has(call.status) || (call.status === "completed" && !call.durationSec)) {
    const rows = await ctx.sql`update quotes set call_status = 'no_answer', next_action_at = null where id = ${quote.id} and call_status = 'calling' returning id`;
    if (rows.length) await advance(ctx, quote.job_id);
    return;
  }
  if (call.status === "completed") {
    await ctx.sql`
      update quotes set call_status = 'answered', next_action_at = ${new Date(ctx.now().getTime() + ctx.limits.extractionWaitSec * 1000)}
      where id = ${quote.id} and call_status = 'calling'`;
  }
}

// A call that never reported an end, or an answered call whose extraction never came, stops holding up the job.
export async function expireQuoteCalls(ctx: Ctx) {
  const due = await ctx.sql<{ job_id: string }[]>`
    update quotes set call_status = case when call_status = 'calling' then 'no_answer' else call_status end, next_action_at = null
    where id in (select id from quotes where next_action_at <= ${ctx.now()} for update skip locked)
    returning job_id`;
  for (const jobId of new Set(due.map((d) => d.job_id))) await advance(ctx, jobId);
}

export async function startDueInvites(ctx: Ctx) {
  const due = await ctx.sql<{ id: string }[]>`
    select id from jobs where status = 'confirmed' and next_action_at <= ${ctx.now()}`;
  for (const { id } of due) await startInviting(ctx, id);
}

type QuoteRow = {
  id: string; ref: string; worker_id: string; name: string; phone: string; language: string; rating: number | null;
  rated_jobs: number; available: boolean | null; price_type: "fixed" | "visit_only" | null;
  price: number | null; visit_charge: number | null;
  material_included: "yes" | "no" | "partly" | null; earliest_arrival: Date | null; distance_km: number | null; quoted_at: Date | null;
};

async function finish(ctx: Ctx, jobId: string) {
  const job = await jobById(ctx.sql, jobId);
  const quotes = await ctx.sql<QuoteRow[]>`
    select q.id, q.ref, q.worker_id, w.name, w.phone, w.language, w.rating::float as rating, w.rating_count as rated_jobs,
           q.available, q.price_type, q.price, q.visit_charge, q.material_included,
           q.earliest_arrival, q.distance_km, q.quoted_at
    from quotes q join workers w on w.id = q.worker_id
    where q.job_id = ${jobId} and q.quoted_at is not null`;
  const ranked = rankQuotes(
    quotes.map((q) => ({
      id: q.id, available: q.available, priceType: q.price_type, price: q.price,
      earliestArrival: q.earliest_arrival, rating: q.rating, ratedJobs: q.rated_jobs, distanceKm: q.distance_km,
      quotedAt: q.quoted_at!, materialIncluded: q.material_included,
    })),
    { priorities: job.priorities, budgetInr: job.budget_inr, windowEnd: job.window_end, customerExpectsMaterial: job.material === "worker_brings" },
  );
  const byId = new Map(quotes.map((q) => [q.id, q]));
  const now = ctx.now();
  const reasons = quoteReasons(job.language, ranked, quotes, now);

  const to = ranked.length ? "quotes_in" : "no_workers";
  const moved = await ctx.sql.begin(async (tx) => {
    if (!(await moveJob(tx, jobId, "inviting", to))) return false;
    for (const r of ranked) {
      await tx`update quotes set rank = ${r.rank}, rank_group = ${r.group}, score = ${r.score}, rank_reason = ${reasons.get(r.id) ?? null} where id = ${r.id}`;
    }
    await tx`update jobs set ranking = ${tx.json(ranked as never)} where id = ${jobId}`;
    return true;
  });
  if (!moved) return;

  if (!ranked.length) {
    const id = await ctx.whatsapp.sendText(toWhatsApp(job.phone), whatsappText(job.language, "no_workers"));
    return recordSent(ctx, job, "no_workers", id);
  }
  const id = await ctx.whatsapp.sendList(toWhatsApp(job.phone), shortlist(job, ranked, byId, reasons, now));
  await recordSent(ctx, job, "shortlist", id);
}

function ratingText(lang: string, q: Pick<QuoteRow, "rating" | "rated_jobs">) {
  return q.rated_jobs >= 3 && q.rating !== null ? q.rating.toFixed(1) : whatsappText(lang, "rating_new");
}

type ReasonQuote = Pick<QuoteRow, "id" | "price" | "rating" | "rated_jobs" | "earliest_arrival">;

// The ranking is stored once; WhatsApp words its reasons in the caller's language, the app in its own.
export function quoteReasons(lang: string, ranked: RankedQuote[], quotes: ReasonQuote[], now: Date) {
  const byId = new Map(quotes.map((q) => [q.id, q]));
  return new Map(ranked.map((r) => [r.id, reasonFor(lang, r, ranked, byId, now)]));
}

// Built from the measure that added most to the score, e.g. "Can come soonest: today 5:30 pm".
function reasonFor(lang: string, r: RankedQuote, ranked: RankedQuote[], byId: Map<string, ReasonQuote>, now: Date) {
  if (r.group !== "ranked" || !r.lead) return null;
  const q = byId.get(r.id)!;
  const lead: Measure = r.lead;
  const best = ranked.filter((x) => x.group === "ranked").every((x) => (x.measures![lead] ?? 0) <= r.measures![lead]);
  const when = q.earliest_arrival ? whenLabel(lang, q.earliest_arrival, now) : whatsappText(lang, "none");
  const text =
    lead === "speed" ? whatsappText(lang, best ? "reason_speed_best" : "reason_speed", { when })
    : lead === "price" ? whatsappText(lang, best ? "reason_price_best" : "reason_price", { price: priceLabel(lang, q.price!) })
    : whatsappText(lang, best ? "reason_quality_best" : "reason_quality", { rating: ratingText(lang, q) });
  const soonest = Math.min(...ranked.filter((x) => x.group === "ranked").map((x) => byId.get(x.id)!.earliest_arrival?.getTime() ?? Infinity));
  const laterDay = lead !== "speed" && q.earliest_arrival && q.earliest_arrival.getTime() > soonest
    && whenLabel(lang, q.earliest_arrival, now).split(" ")[0] !== whenLabel(lang, new Date(soonest), now).split(" ")[0];
  return laterDay ? text + whatsappText(lang, "reason_but_later", { when: whenLabel(lang, q.earliest_arrival!, now).split(" ")[0]! }) : text;
}

const cut = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

function shortlist(job: JobRow, ranked: RankedQuote[], byId: Map<string, QuoteRow>, reasons: Map<string, string | null>, now: Date) {
  const lang = job.language;
  const t = (key: string, vars?: Record<string, string | number>) => whatsappText(lang, key, vars);
  const when = (q: QuoteRow) => (q.earliest_arrival ? whenLabel(lang, q.earliest_arrival, now) : t("none"));
  const labels = (r: RankedQuote) => (r.labels.length ? ` (${r.labels.map((l) => t(`label_${l}`)).join(", ")})` : "");
  const inGroup = (g: RankedQuote["group"]) => ranked.filter((r) => r.group === g);
  const withFee = (q: QuoteRow) => {
    const amount = q.price ?? q.visit_charge;
    const fee = bookingFee(amount ?? 0);
    return amount === null ? t("fee_only", { fee })
      : t(q.price === null ? "visit_with_fee" : "price_with_fee", { price: amount, fee });
  };

  const lines = [t("shortlist_intro", { job: jobLabel(job) }), ""];
  for (const r of inGroup("ranked")) {
    const q = byId.get(r.id)!;
    lines.push(t("shortlist_line", { n: r.rank, name: q.name, price: withFee(q), when: when(q), rating: ratingText(lang, q), reason: reasons.get(r.id) ?? "", labels: labels(r) }));
  }
  if (inGroup("visit").length) {
    lines.push("", t("shortlist_visit_title"));
    for (const r of inGroup("visit")) {
      const q = byId.get(r.id)!;
      lines.push(t("shortlist_visit_line", { name: q.name, when: when(q), rating: ratingText(lang, q), visit: withFee(q) }));
    }
  }
  if (inGroup("later").length) lines.push("", t("shortlist_later", { count: inGroup("later").length }));
  if (!job.photo_url) lines.push("", t("shortlist_no_photo"));
  lines.push("", t("shortlist_footer"));

  const row = (r: RankedQuote) => {
    const q = byId.get(r.id)!;
    return {
      id: `book:${q.ref}`,
      title: cut(`${r.rank}. ${q.name}`, 24),
      description: cut([withFee(q), t("row_description", { when: when(q), rating: ratingText(lang, q) })].filter(Boolean).join(" · "), 72),
    };
  };
  const sections: ListMessage["sections"] = (
    [["ranked", "section_ranked"], ["visit", "section_visit"], ["later", "section_later"]] as const
  ).map(([g, title]) => ({ title: t(title), rows: inGroup(g).map(row) })).filter((s) => s.rows.length);
  sections.push({ title: t("section_more"), rows: [{ id: `cancel:${job.ref}`, title: t("row_cancel") }] });

  return { header: t("shortlist_header", { count: ranked.length }), body: cut(lines.join("\n"), 1024), button: t("list_button"), sections };
}

// A photo that arrives after calls started goes straight to every worker already contacted.
export async function forwardPhoto(ctx: Ctx, jobId: string) {
  const job = await jobById(ctx.sql, jobId);
  const link = await photoLink(ctx, job.photo_url);
  if (!link) return;
  const workers = await ctx.sql<{ phone: string; language: string }[]>`
    select w.phone, w.language from quotes q join workers w on w.id = q.worker_id
    where q.job_id = ${jobId} and q.call_status <> ${"no_answer"} order by q.call_order`;
  for (const w of workers) await ctx.whatsapp.sendImage(toWhatsApp(w.phone), link, jobLabel({ ...job, language: w.language }));
}
