import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { backend } from "./api";
import { SESSION_COOKIE } from "./session-cookie";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function saveSession(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

// The real check: asks the backend whether the session is live. Cached for one render pass.
export const requireCustomer = cache(async () => {
  const token = await sessionToken();
  if (!token) redirect("/login");
  const { status, data } = await backend<{ ok: boolean; phone: string; role: string }>("/me", { token });
  if (status !== 200 || data.role !== "customer") redirect("/login");
  return { token, phone: data.phone };
});

export async function endSession() {
  const token = await sessionToken();
  if (token) await backend("/auth/logout", { method: "POST", token });
  (await cookies()).delete(SESSION_COOKIE);
}
