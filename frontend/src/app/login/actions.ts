"use server";

import { redirect } from "next/navigation";
import { backend } from "@/lib/api";
import { saveSession } from "@/lib/session";

export type LoginState = { step: "phone" | "code"; phone: string; error: string | null };

const ERRORS: Record<string, string> = {
  invalid_phone: "Ye number sahi nahi lag raha. 10 ank ka mobile number daaliye.",
  too_many_codes: "Bahut baar code maanga gaya. 15 minute baad phir koshish kijiye.",
  wrong_code: "Code galat hai ya purana ho gaya. Dobara daaliye ya naya code mangaiye.",
};
const SOMETHING_WRONG = "Kuch gadbad hui. Thodi der baad phir koshish kijiye.";

export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = String(form.get("phone") ?? "").replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) return { step: "phone", phone, error: ERRORS.invalid_phone! };
  const { data } = await backend<{ ok: boolean; error?: string }>("/auth/start", { method: "POST", body: { phone, role: "customer" } });
  if (!data.ok) return { step: "phone", phone, error: ERRORS[data.error ?? ""] ?? SOMETHING_WRONG };
  return { step: "code", phone, error: null };
}

export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = String(form.get("phone") ?? "");
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  const { data } = await backend<{ ok: boolean; token?: string; error?: string }>("/auth/verify", {
    method: "POST",
    body: { phone, role: "customer", code },
  });
  if (!data.ok || !data.token) return { step: "code", phone, error: ERRORS[data.error ?? ""] ?? SOMETHING_WRONG };
  await saveSession(data.token);
  redirect("/account");
}
