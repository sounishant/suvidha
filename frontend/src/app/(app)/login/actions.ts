"use server";

import { redirect } from "next/navigation";
import { backend } from "@/lib/api";
import { saveSession } from "@/lib/session";

export type Role = "customer" | "worker";
export type LoginState = { step: "phone" | "code"; phone: string; name: string; error: string | null };

const ERRORS: Record<string, string> = {
  invalid_phone: "This number doesn’t look right. Enter your 10-digit mobile number.",
  too_many_codes: "Too many codes or wrong tries. Please try again after some time.",
  wrong_code: "The code is wrong or has expired. Try again or ask for a new code.",
  no_name: "Please enter your name.",
  long_name: "Keep your name under 60 letters.",
};
const SOMETHING_WRONG = "Something went wrong. Please try again in a little while.";
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
