import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeCheck, LogOut, MessageCircle, Phone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CALL, whatsappLink } from "@/lib/contact";
import { TRADE } from "@/lib/job-text";
import { workerHome } from "@/lib/session";
import { workerLogout } from "../actions";

export const metadata: Metadata = { title: "Account · suvidha" };

export default function WorkerProfilePage() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Account</h1>
      <Suspense fallback={<div className="h-48 rounded-2xl border bg-white" aria-busy="true" aria-label="Loading account" />}>
        <Details />
      </Suspense>

      <section aria-labelledby="help" className="grid gap-1 rounded-2xl border bg-white p-2">
        <h2 id="help" className="px-4 pb-1 pt-3 text-sm font-medium text-muted-foreground">Help</h2>
        <a href={CALL.tel} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium hover:bg-muted">
          <Phone className="size-5 text-primary" aria-hidden="true" /> Call the suvidha team
        </a>
        <a href={whatsappLink("Hello suvidha, I’m a worker and I need help.")} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium hover:bg-muted">
          <MessageCircle className="size-5 text-primary" aria-hidden="true" /> Message us on WhatsApp
        </a>
      </section>

      <form action={workerLogout}>
        <Button type="submit" variant="outline" className="h-12 w-full rounded-xl text-base text-destructive">
          <LogOut className="size-4" aria-hidden="true" /> Log out
        </Button>
      </form>
    </div>
  );
}

async function Details() {
  const { profile, phone } = await workerHome();
  return (
    <section aria-labelledby="me" className="grid gap-5 rounded-2xl border bg-white p-6">
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-2xl font-semibold text-white" aria-hidden="true">
          {profile.name.charAt(0).toUpperCase()}
        </span>
        <div>
          <h2 id="me" className="text-xl font-semibold">{profile.name}</h2>
          <p className="text-muted-foreground tabular-nums">+91 {phone.slice(3, 8)} {phone.slice(8)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-base">
        <dt className="text-muted-foreground">Work</dt>
        <dd className="font-medium">{profile.trades.map((t) => TRADE[t] ?? t).join(", ")}</dd>
        <dt className="text-muted-foreground">ID</dt>
        <dd className="flex items-center gap-1.5 font-medium">
          {profile.verified ? <><BadgeCheck className="size-4 text-primary" aria-hidden="true" /> Verified</> : "Not verified yet"}
        </dd>
        <dt className="text-muted-foreground">Rating</dt>
        <dd className="flex items-center gap-1.5 font-medium">
          {profile.rating !== null ? <><Star className="size-4 fill-[var(--sun)] text-[var(--sun)]" aria-hidden="true" /> {profile.rating.toFixed(1)}</> : "Shows after 3 ratings"}
        </dd>
      </dl>
      <p className="text-sm text-muted-foreground">Want to change your name or work? Call the suvidha team.</p>
    </section>
  );
}
