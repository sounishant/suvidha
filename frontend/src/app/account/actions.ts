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

export type JobFormState = { error: string | null; done: string | null };

// One box for both: the backend treats it as the answer when a question is waiting, otherwise as a note for the workers.
export async function sendJobMessage(jobRef: string, _prev: JobFormState, form: FormData): Promise<JobFormState> {
  const text = String(form.get("text") ?? "").trim();
  if (!text) return { error: "Please write something first.", done: null };
  if (text.length > 500) return { error: "Keep it under 500 letters.", done: null };
  const { token } = await requireCustomer();
  const { data } = await backend<{ ok: boolean; kind?: "answered" | "noted" }>(`/customer/jobs/${encodeURIComponent(jobRef)}/message`, { method: "POST", token, body: { text } });
  if (!data.ok) return { error: "This job can’t take changes any more. Please call us.", done: null };
  revalidatePath(`/account/jobs/${jobRef}`);
  return { error: null, done: data.kind === "answered" ? "Thanks, got it." : "Sent to the workers." };
}

const PHOTO_ERRORS: Record<string, string> = {
  bad_photo: "That file isn’t a photo we can use. Please choose a JPG or PNG photo.",
  not_open: "This job can’t take a photo any more.",
  not_stored: "We couldn’t save the photo just now. Please send it on WhatsApp instead.",
};

export async function uploadJobPhoto(jobRef: string, _prev: JobFormState, form: FormData): Promise<JobFormState> {
  const photo = form.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) return { error: "Please choose a photo.", done: null };
  if (photo.size > 5 * 1024 * 1024) return { error: "This photo is too big. Please choose a smaller one.", done: null };
  const { token } = await requireCustomer();
  const { data } = await backend<{ ok: boolean; error?: string }>(`/customer/jobs/${encodeURIComponent(jobRef)}/photo`, { method: "POST", token, body: photo });
  if (!data.ok) return { error: PHOTO_ERRORS[data.error ?? ""] ?? "Something went wrong. Please try again in a little while.", done: null };
  revalidatePath(`/account/jobs/${jobRef}`);
  return { error: null, done: "Photo added. Workers will see it." };
}

export async function cancelJob(jobRef: string) {
  const { token } = await requireCustomer();
  const { data } = await backend<{ ok: boolean }>(`/customer/jobs/${encodeURIComponent(jobRef)}/cancel`, { method: "POST", token });
  revalidatePath("/account", "layout");
  redirect(`/account/jobs/${encodeURIComponent(jobRef)}${data.ok ? "" : "?cancel=failed"}`);
}
