import { toJobType, toTrade, type Trade } from "./catalogue.ts";
import { PRIORITIES, type Priority } from "./ranking.ts";
import { istDayStart } from "./time.ts";

const EMPTY = new Set(["", "null", "none", "n/a", "na", "nil", "-", "unknown", "not mentioned", "not provided", "not given", "no answer"]);

const keyOf = (k: string) => k.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const ANSWER_KEYS = ["objective", "subjective", "value", "answer"];

const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v !== "object" && EMPTY.has(String(v).trim().toLowerCase()));

// Bolna nests extractions by category; each field's result is {objective?, subjective?, confidence, reasoning…}.
// The chosen option wins over free text. Flattened to field -> text.
export function flattenExtraction(data: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (value: unknown, key: string) => {
    if (value === null || value === undefined) return;
    if (typeof value !== "object") {
      const text = String(value).trim();
      if (key && !EMPTY.has(text.toLowerCase()) && !out.has(key)) out.set(key, text);
      return;
    }
    if (Array.isArray(value)) {
      const parts = value.filter((v) => typeof v !== "object").map(String);
      if (parts.length) walk(parts.join(", "), key);
      return;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    const answers = new Map(entries.filter(([k]) => ANSWER_KEYS.includes(keyOf(k))).map(([k, v]) => [keyOf(k), v]));
    if (answers.size && key) return walk(ANSWER_KEYS.map((k) => answers.get(k)).find((v) => !isEmpty(v)), key);
    for (const [k, v] of entries) walk(v, keyOf(k));
  };
  walk(data, "");
  return out;
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function toMaterial(text: string) {
  const t = text.toLowerCase();
  if (has(t, ["not sure", "pata nahi", "pata nhi", "पता नहीं"])) return "not_sure";
  if (has(t, ["worker", "carpenter", "plumber", "electrician", "bring", "laaye", "laye", "le aaye", "लाए", "लाये"])) return "worker_brings";
  if (has(t, ["customer", "have", "has", "mere paas", "hamare paas", "paas hai", "पास है"])) return "customer_has";
  return "not_sure";
}

export function toPriority(text: string): Priority | null {
  const t = text.toLowerCase();
  if (has(t, ["speed", "fast", "quick", "jaldi", "late", "der", "जल्दी", "देर"])) return "speed";
  if (has(t, ["price", "cheap", "sasta", "paise", "overcharg", "zyada paise", "सस्ता", "पैसे"])) return "price";
  if (has(t, ["quality", "achha", "accha", "theek", "kaam", "अच्छा", "ठीक"])) return "quality";
  return null;
}

export function toPriorities(...texts: (string | undefined)[]): Priority[] {
  const found = texts.flatMap((t) => (t ? t.split(/[,>]|\bthen\b|\bphir\b/).map(toPriority) : []));
  return [...new Set(found.filter((p): p is Priority => p !== null && PRIORITIES.includes(p)))];
}

// "Rs 300 to 500" → 500: the top of the range is what a quote is compared against.
export function toBudget(text: string) {
  const numbers = (text.replace(/,/g, "").match(/\d+/g) ?? []).map(Number).filter((n) => n > 0);
  return numbers.length ? Math.max(...numbers) : null;
}

export function toNumber(text: string | undefined) {
  const n = Number((text ?? "").replace(/[^\d.]/g, ""));
  return text && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// Times without a zone are what the caller said in India.
export function toTimestamp(text: string | undefined) {
  if (!text) return null;
  const t = text.trim();
  const zoned = /([zZ]|[+-]\d{2}:?\d{2})$/.test(t) ? t : /^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}/.test(t) ? `${t.replace(" ", "T")}+05:30` : t;
  const ms = Date.parse(zoned);
  return Number.isNaN(ms) ? null : new Date(ms);
}

// The extraction never sees today's date, so a timestamp it writes counts only if it is near the call.
function plausible(d: Date | null, now: Date) {
  if (!d) return null;
  const t = d.getTime() - now.getTime();
  return t >= -3600_000 && t <= 30 * 86_400_000 ? d : null;
}

// "18:00", "6 pm", "6:30 pm" → minutes after midnight.
export function toClock(text: string | undefined) {
  const m = text?.trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  if (m[3] === "pm" && hour < 12) hour += 12;
  if (m[3] === "am" && hour === 12) hour = 0;
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

function dayOffset(text: string | undefined) {
  const t = text?.toLowerCase() ?? "";
  if (has(t, ["today", "aaj", "आज"])) return 0;
  if (has(t, ["tomorrow", "kal", "कल"])) return 1;
  if (has(t, ["week", "hafte", "हफ़्ते"])) return 6;
  if (has(t, ["later", "baad"])) return 2;
  return null;
}

// A day the extraction picked, plus a time if one was said, on the call's own calendar in India time.
export function onDay(day: string | undefined, time: string | undefined, now: Date, untimed: "end" | "morning") {
  const offset = dayOffset(day);
  if (offset === null) return null;
  const clock = toClock(time) ?? (untimed === "end" ? 24 * 60 - 1 : 10 * 60);
  return new Date(istDayStart(now).getTime() + offset * 86_400_000 + clock * 60_000);
}

export function toYesNo(text: string | undefined) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/^(yes|y|true|haan?|हाँ|हां|available)/.test(t)) return true;
  if (/^(no|n|false|nahi|nahin|नहीं|not available)/.test(t)) return false;
  return null;
}

export type Urgency = "today" | "tomorrow" | "this_week" | "flexible";

export function inferUrgency(windowEnd: Date | null, now: Date): Urgency {
  if (!windowEnd) return "flexible";
  const day = 24 * 3600_000;
  const startOfToday = istDayStart(now).getTime();
  const t = windowEnd.getTime();
  if (t < startOfToday + day) return "today";
  if (t < startOfToday + 2 * day) return "tomorrow";
  if (t < startOfToday + 7 * day) return "this_week";
  return "flexible";
}

export type CustomerCard = {
  trade: Trade | null;
  jobType: string | null;
  jobTypeOther: string | null;
  problem: string | null;
  material: "customer_has" | "worker_brings" | "not_sure" | null;
  firstName: string | null;
  address: string | null;
  siteContact: string | null;
  timeWindowText: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
  priorities: Priority[];
  priorityVariant: string | null;
  budgetInr: number | null;
  safetyNote: string | null;
  complexity: "standard" | "custom" | "unclear" | null;
  language: string | null;
};

export function customerCard(data: unknown, now: Date): CustomerCard {
  const f = flattenExtraction(data);
  const get = (...keys: string[]) => keys.map((k) => f.get(k)).find((v) => v !== undefined);
  const tradeText = get("trade");
  const trade = tradeText ? toTrade(tradeText) : null;
  const jobTypeText = get("job_type");
  const jobType = trade && jobTypeText ? toJobType(trade, jobTypeText) : null;
  const complexityText = get("complexity")?.toLowerCase();
  const languageText = get("language")?.toLowerCase();
  const materialText = get("material");
  const windowText = get("time_window", "time_window_text");
  return {
    trade,
    jobType,
    jobTypeOther: jobType === "other" ? (get("job_type_other") ?? jobTypeText ?? null) : null,
    problem: get("problem") ?? null,
    material: materialText ? toMaterial(materialText) : null,
    firstName: get("first_name", "name", "customer_name") ?? null,
    address: get("address", "full_address") ?? null,
    siteContact: get("site_contact") ?? null,
    timeWindowText: windowText ?? null,
    windowStart: plausible(toTimestamp(get("time_window_earliest", "earliest")), now),
    windowEnd: plausible(toTimestamp(get("time_window_latest", "latest")), now) ?? onDay(get("time_window_day"), get("time_window_time"), now, "end"),
    priorities: toPriorities(get("priority_order"), get("priority_first", "priority"), get("priority_second"), get("priority_third")),
    priorityVariant: get("priority_variant") ?? null,
    budgetInr: toBudget(get("budget") ?? ""),
    safetyNote: get("safety_note") ?? null,
    complexity: complexityText && ["standard", "custom", "unclear"].includes(complexityText) ? (complexityText as CustomerCard["complexity"]) : null,
    language: languageText ? (languageText.startsWith("en") ? "en" : "hi") : null,
  };
}

export const REQUIRED_FIELDS = ["trade", "job_type", "problem", "material", "address", "time_window", "priority"] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export function missingFields(card: Pick<CustomerCard, "trade" | "jobType" | "problem" | "material" | "address" | "timeWindowText" | "windowEnd" | "priorities">): RequiredField[] {
  const filled: Record<RequiredField, boolean> = {
    trade: card.trade !== null,
    job_type: card.jobType !== null,
    problem: card.problem !== null,
    material: card.material !== null,
    address: card.address !== null,
    time_window: card.windowEnd !== null || card.timeWindowText !== null,
    priority: card.priorities.length > 0,
  };
  return REQUIRED_FIELDS.filter((k) => !filled[k]);
}

export type WorkerQuote = {
  available: boolean | null;
  declineReason: "busy" | "too_far" | "not_my_skill" | "other" | null;
  priceType: "fixed" | "range" | "visit_only" | null;
  priceMin: number | null;
  priceMax: number | null;
  visitCharge: number | null;
  materialIncluded: "yes" | "no" | "partly" | null;
  earliestArrival: Date | null;
  durationMins: number | null;
  note: string | null;
};

export function workerQuote(data: unknown, now: Date): WorkerQuote {
  const f = flattenExtraction(data);
  const get = (...keys: string[]) => keys.map((k) => f.get(k)).find((v) => v !== undefined);
  const available = toYesNo(get("available"));
  const reason = get("decline_reason")?.toLowerCase() ?? "";
  const typeText = get("price_type")?.toLowerCase() ?? "";
  const single = toNumber(get("price"));
  const priceMin = toNumber(get("price_min")) ?? single;
  const priceMax = toNumber(get("price_max")) ?? single ?? priceMin;
  const priceType: WorkerQuote["priceType"] =
    available !== true ? null
    : typeText.includes("visit") ? "visit_only"
    : priceMin === null ? "visit_only"
    : priceMax !== null && priceMax !== priceMin ? "range"
    : "fixed";
  const material = get("material_included")?.toLowerCase();
  const inMinutes = toNumber(get("arrival_in_minutes"));
  // "20 minute mein" is the most reliable; then a day and time; a day alone today means within the hour.
  const arrival = inMinutes !== null ? new Date(now.getTime() + inMinutes * 60_000)
    : get("arrival_time") || dayOffset(get("arrival_day")) !== 0 ? onDay(get("arrival_day"), get("arrival_time"), now, "morning")
    : new Date(now.getTime() + 3600_000);
  return {
    available,
    declineReason: available !== false ? null
      : has(reason, ["busy", "vyast", "time nahi"]) ? "busy"
      : has(reason, ["far", "door", "dur"]) ? "too_far"
      : has(reason, ["skill", "nahi aata", "mera kaam nahi"]) ? "not_my_skill"
      : "other",
    priceType,
    priceMin: priceType === "fixed" || priceType === "range" ? priceMin : null,
    priceMax: priceType === "fixed" || priceType === "range" ? priceMax : null,
    visitCharge: toNumber(get("visit_charge")),
    materialIncluded: material ? (material.startsWith("y") || material.startsWith("haan") ? "yes" : material.startsWith("part") ? "partly" : "no") : null,
    earliestArrival: (get("arrival_in_minutes") || get("arrival_day") ? arrival : null) ?? plausible(toTimestamp(get("earliest_arrival")), now),
    durationMins: toNumber(get("duration_mins", "duration")),
    note: get("note") ?? null,
  };
}
