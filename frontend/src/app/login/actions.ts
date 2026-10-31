"use server";

import { redirect } from "next/navigation";
import { backend } from "@/lib/api";
import { saveSession } from "@/lib/session";

export type Role = "customer" | "worker";
export type LoginState = { step: "phone" | "code"; phone: string; name: string; error: string | null };

const ERRORS: Record<string, string> = {
  invalid_phone: "Ye number sahi nahi lag raha. 10 ank ka mobile number daaliye.",
  too_many_codes: "Bahut baar code maanga gaya. 15 minute baad phir koshish kijiye.",
  wrong_code: "Code galat hai ya purana ho gaya. Dobara daaliye ya naya code mangaiye.",
  no_name: "Apna naam likhiye.",
  long_name: "Naam 60 akshar se chhota rakhiye.",
};
const SOMETHING_WRONG = "Kuch gadbad hui. Thodi der baad phir koshish kijiye.";
const HOME: Record<Role, string> = { customer: "/account", worker: "/worker" };

const roleOf = (form: FormData): Role => (form.get("role") === "worker" ? "worker" : "customer");
const nameOf = (form: FormData) => String(form.get("name") ?? "").trim().replace(/\s+/g, " ");

export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = String(form.get("phone") ?? "").replace(/\D/g, "").slice(-10);
  const name = nameOf(form);
  const fail = (error: string): LoginState => ({ step: "phone", phone, name, error });
  // Only signup sends a name field; plain login leaves it out.
  if (form.has("name") && !name) return fail(ERRORS.no_name!);
  if (name.length > 60) return fail(ERRORS.long_name!);
  if (phone.length !== 10) return fail(ERRORS.invalid_phone!);
  const { data } = await backend<{ ok: boolean; error?: string }>("/auth/start", { method: "POST", body: { phone, role: roleOf(form) } });
  if (!data.ok) return fail(ERRORS[data.error ?? ""] ?? SOMETHING_WRONG);
  return { step: "code", phone, name, error: null };
}

export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const role = roleOf(form);
  const phone = String(form.get("phone") ?? "");
  const name = nameOf(form);
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  const { data } = await backend<{ ok: boolean; token?: string; needsName?: boolean; error?: string }>("/auth/verify", {
    method: "POST",
    body: { phone, role, code },
  });
  if (!data.ok || !data.token) return { step: "code", phone, name, error: ERRORS[data.error ?? ""] ?? SOMETHING_WRONG };
  await saveSession(data.token);

  let needsName = role === "customer" && data.needsName;
  if (needsName && name) {
    const saved = await backend<{ ok: boolean }>("/customer/profile", { method: "POST", token: data.token, body: { name } });
    needsName = !saved.data.ok;
  }
  redirect(needsName ? "/welcome" : HOME[role]);
}
