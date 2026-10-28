import { toJobType, toTrade, type Trade } from "./catalogue.ts";
import { PRIORITIES, type Priority } from "./ranking.ts";
import { istDayStart } from "./time.ts";

const EMPTY = new Set(["", "null", "none", "n/a", "na", "nil", "-", "unknown", "not mentioned", "not provided", "not given", "no answer"]);

const keyOf = (k: string) => k.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// Bolna nests extractions by category and sometimes wraps a value ({"subjective": "..."}); flatten to field -> text.
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
    const wrapped = entries.length === 1 && ["subjective", "value", "answer", "objective"].includes(keyOf(entries[0]![0]));
    if (wrapped && key) return walk(entries[0]![1], key);
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

export function customerCard(data: unknown): CustomerCard {
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
    windowStart: toTimestamp(get("time_window_earliest", "earliest")),
    windowEnd: toTimestamp(get("time_window_latest", "latest")),
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

export function workerQuote(data: unknown): WorkerQuote {
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
    earliestArrival: toTimestamp(get("earliest_arrival")),
    durationMins: toNumber(get("duration_mins", "duration")),
    note: get("note") ?? null,
  };
}
