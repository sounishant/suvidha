"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { backend } from "@/lib/api";
import { endSession, requireWorker } from "@/lib/session";

export type FormState = { error: string | null };

const STEP_ERRORS: Record<string, string> = {
  wrong_code: "Wrong code. Ask the customer again.",
  code_locked: "A wrong code was entered 5 times. Please call the suvidha team for help.",
  wrong_step: "This step can’t be done right now. Open the page again to check.",
  not_found: "This job isn’t assigned to you.",
};
const SOMETHING_WRONG = "Something went wrong. Please try again in a little while.";

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
    if (!["fixed", "visit_only"].includes(quote.priceType ?? "")) return { error: "Choose how you’ll price it." };
    if (quote.priceType !== "visit_only" && !quote.price) return { error: "Enter your price in rupees." };
    if (!Number.isInteger(quote.arrivalInMinutes)) return { error: "Choose how soon you can arrive." };
  }

  const { token } = await requireWorker();
  const { status, data } = await backend<{ ok: boolean; error?: string }>(`/worker/quotes/${encodeURIComponent(quoteRef)}`, { method: "POST", token, body: quote });
  if (status === 409) return { error: "This job isn’t taking prices any more." };
  if (!data.ok) return { error: SOMETHING_WRONG };
  revalidatePath("/worker", "layout");
  redirect("/worker");
}

export async function bookingStep(jobRef: string, kind: "trip" | "start" | "done" | "finish", _prev: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if ((kind === "start" || kind === "finish") && code.length !== 4) return { error: "Enter the 4-digit code." };
  const body = kind === "start" || kind === "finish" ? { code } : kind === "done" ? { finalPrice: rupeesOf(form, "finalPrice") } : {};

  const { token } = await requireWorker();
  const { data } = await backend<{ ok: boolean; error?: string }>(`/worker/jobs/${encodeURIComponent(jobRef)}/${kind}`, { method: "POST", token, body });
  if (!data.ok) return { error: STEP_ERRORS[data.error ?? ""] ?? SOMETHING_WRONG };
  revalidatePath("/worker", "layout");
  return { error: null };
}

export async function cantCome(jobRef: string) {
  const { token } = await requireWorker();
  const { data } = await backend<{ ok: boolean }>(`/worker/jobs/${encodeURIComponent(jobRef)}/cancel`, { method: "POST", token });
  revalidatePath("/worker", "layout");
  redirect(data.ok ? "/worker" : `/worker/jobs/${encodeURIComponent(jobRef)}?cancel=failed`);
}
