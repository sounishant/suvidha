"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { backend } from "@/lib/api";
import { endSession, requireWorker } from "@/lib/session";

export type FormState = { error: string | null };

const STEP_ERRORS: Record<string, string> = {
  wrong_code: "Code galat hai. Customer se dobara poochiye.",
  code_locked: "5 baar galat code daala gaya. Ab suvidha team ko call kijiye, wo madad karenge.",
  wrong_step: "Ye kadam abhi nahi ho sakta. Page dobara khol ke dekhiye.",
  not_found: "Ye kaam aapke naam pe nahi mila.",
};
const SOMETHING_WRONG = "Kuch gadbad hui. Thodi der baad phir koshish kijiye.";

export async function workerLogout() {
  await endSession();
  redirect("/login/worker");
}

const rupeesOf = (form: FormData, key: string) => {
  const raw = String(form.get(key) ?? "").replace(/[^\d]/g, "");
  return raw ? Number(raw) : null;
};

export async function sendQuote(quoteRef: string, _prev: FormState, form: FormData): Promise<FormState> {
  const available = form.get("available") === "yes";
  const priceType = available ? (String(form.get("priceType") ?? "") as "fixed" | "visit_only") : null;
  const quote = {
    available,
    declineReason: available ? null : String(form.get("declineReason") ?? "other"),
    priceType,
    price: priceType === "visit_only" ? null : rupeesOf(form, "price"),
    visitCharge: priceType === "visit_only" ? rupeesOf(form, "visitCharge") : null,
    materialIncluded: available ? (String(form.get("materialIncluded") ?? "") || null) : null,
    arrivalInMinutes: available ? Number(form.get("arrivalInMinutes") ?? NaN) : null,
    note: String(form.get("note") ?? "").trim() || null,
  };

  if (available) {
    if (!["fixed", "visit_only"].includes(quote.priceType ?? "")) return { error: "Daam kaisa hai, chuniye." };
    if (quote.priceType !== "visit_only" && !quote.price) return { error: "Apna daam rupaye mein likhiye." };
    if (!Number.isInteger(quote.arrivalInMinutes)) return { error: "Kab tak pahunchenge, chuniye." };
  }

  const { token } = await requireWorker();
  const { status, data } = await backend<{ ok: boolean; error?: string }>(`/worker/quotes/${encodeURIComponent(quoteRef)}`, { method: "POST", token, body: quote });
  if (status === 409) return { error: "Ye kaam ab daam nahi le raha. Shayad kisi aur ne pehle bhej diya." };
  if (!data.ok) return { error: SOMETHING_WRONG };
  revalidatePath("/worker", "layout");
  redirect("/worker");
}

export async function bookingStep(jobRef: string, kind: "trip" | "start" | "done" | "finish", _prev: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if ((kind === "start" || kind === "finish") && code.length !== 4) return { error: "4 ank ka code daaliye." };
  const body = kind === "start" || kind === "finish" ? { code } : kind === "done" ? { finalPrice: rupeesOf(form, "finalPrice") } : {};

  const { token } = await requireWorker();
  const { data } = await backend<{ ok: boolean; error?: string }>(`/worker/jobs/${encodeURIComponent(jobRef)}/${kind}`, { method: "POST", token, body });
  if (!data.ok) return { error: STEP_ERRORS[data.error ?? ""] ?? SOMETHING_WRONG };
  revalidatePath("/worker", "layout");
  return { error: null };
}
