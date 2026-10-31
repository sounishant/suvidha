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
  const { data } = await backend<{ ok: boolean }>(`/customer/jobs/${encodeURIComponent(jobRef)}/book`, {
    method: "POST",
    token,
    body: { quoteRef },
  });
  revalidatePath("/account");
  // Another tap may have booked first, or the quote is no longer open.
  if (!data.ok) redirect(`/account/jobs/${encodeURIComponent(jobRef)}?book=failed`);
  revalidatePath(`/account/jobs/${jobRef}`);
}
