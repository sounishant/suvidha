import { readFileSync } from "node:fs";
import { istDayStart } from "./core/time.ts";

type Section = "trade" | "job_type" | "material" | "priority" | "voice" | "whatsapp";
type Copy = Record<Section, Record<string, string>>;

const dir = new URL("../messages/", import.meta.url);
const copy: Record<string, Copy> = Object.fromEntries(
  ["hi", "en"].map((lang) => [lang, JSON.parse(readFileSync(new URL(`${lang}.json`, dir), "utf8")) as Copy]),
);

// Languages without a reviewed copy file yet fall back to Hindi, the agents' starting language.
export function copyFor(lang: string | null | undefined): Copy {
  return copy[lang ?? "hi"] ?? copy.hi!;
}

export function fill(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export function say(lang: string | null | undefined, key: string, vars?: Record<string, string | number>) {
  return fill(copyFor(lang).voice[key]!, vars);
}

export function whatsappText(lang: string | null | undefined, key: string, vars?: Record<string, string | number>) {
  return fill(copyFor(lang).whatsapp[key]!, vars);
}

export function label(lang: string | null | undefined, section: "trade" | "job_type" | "material" | "priority", key: string) {
  return copyFor(lang)[section][key] ?? key;
}

export function tradeName(lang: string | null | undefined, trade: string) {
  return label(lang, "trade", trade);
}

export function placeText(lang: string | null | undefined, locality: string, landmark: string | null) {
  return landmark ? say(lang, "place_near", { locality, landmark }) : locality;
}

export function priceLabel(lang: string | null | undefined, min: number, max: number) {
  return min === max ? whatsappText(lang, "price_fixed", { price: min }) : whatsappText(lang, "price_range", { min, max });
}

const IST = "Asia/Kolkata";

// "aaj 5:30 pm", "kal 10 am", "30 Oct 4 pm" in India time.
export function whenLabel(lang: string | null | undefined, at: Date, now: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(at);
  const hour = parts.find((p) => p.type === "hour")!.value;
  const minute = parts.find((p) => p.type === "minute")!.value;
  const period = parts.find((p) => p.type === "dayPeriod")!.value.toLowerCase();
  const time = `${hour}${minute === "00" ? "" : `:${minute}`} ${period}`;
  const days = Math.floor((istDayStart(at).getTime() - istDayStart(now).getTime()) / 86_400_000);
  if (days === 0) return whatsappText(lang, "today", { time });
  if (days === 1) return whatsappText(lang, "tomorrow", { time });
  const date = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short" }).format(at);
  return whatsappText(lang, "on_date", { date, time });
}
