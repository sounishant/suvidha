"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { backend } from "@/lib/api";
import { endSession, requireCustomer } from "@/lib/session";

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function bookWorker(jobRef: string, quoteRef: string) {
  const { token } = await requireCustomer();
  const { data } = await backend<{ ok: boolean; payUrl?: string | null }>(`/customer/jobs/${encodeURIComponent(jobRef)}/book`, {
    method: "POST",
    token,
    body: { quoteRef },
  });
  revalidatePath("/account");
  // Another tap may have booked first, or the quote is no longer open.
  if (!data.ok) redirect(`/account/jobs/${encodeURIComponent(jobRef)}?book=failed`);
  revalidatePath(`/account/jobs/${jobRef}`);
  // No link means credit already paid the fee and the booking is made.
  if (data.payUrl) redirect(data.payUrl);
}

export type NameState = { error: string | null; saved: boolean };

// `next` is where to go after saving: the dashboard after signup, or stay on the profile page.
export async function saveName(next: "/account" | null, _prev: NameState, form: FormData): Promise<NameState> {
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Please enter your name.", saved: false };
  if (name.length > 60) return { error: "Keep your name under 60 letters.", saved: false };
  const { token } = await requireCustomer();
  const { data } = await backend<{ ok: boolean }>("/customer/profile", { method: "POST", token, body: { name } });
  if (!data.ok) return { error: "Couldn't save your name. Please try again in a little while.", saved: false };
  revalidatePath("/account", "layout");
  if (next) redirect(next);
  return { error: null, saved: true };
}
