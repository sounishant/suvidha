import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, ChevronRight, Clock, MapPin, TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ActiveJob, Invite } from "@/lib/api";
import { TRADE, rupees } from "@/lib/job-text";
import { workerHome } from "@/lib/session";
import { cn } from "@/lib/utils";
import { JOB_MATERIAL, STAGE, myQuoteText } from "@/lib/worker-text";

export const metadata: Metadata = { title: "Jobs · suvidha" };

export default function WorkerHomePage() {
  return (
    <Suspense fallback={<div className="grid gap-4" aria-busy="true" aria-label="Loading jobs"><div className="h-28 rounded-2xl border bg-white" /><div className="h-52 rounded-2xl border bg-white" /></div>}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const home = await workerHome();
  const open = home.invites.filter((i) => i.state === "open");
  const sent = home.invites.filter((i) => i.state === "sent");
  const closed = home.invites.filter((i) => i.state === "closed").slice(0, 3);

  return (
    <div className="grid gap-8">
      <header className="grid gap-1">
        <p className="flex items-center gap-1.5 text-muted-foreground">
          {home.profile.trades.map((t) => TRADE[t] ?? t).join(", ")}
          {home.profile.verified && <><BadgeCheck className="size-4 text-primary" aria-hidden="true" /> ID verified</>}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Hello, {home.profile.name}</h1>
        <p className="text-muted-foreground">
          This month: {home.earnings.monthJobs} {home.earnings.monthJobs === 1 ? "job" : "jobs"} · <span className="font-medium text-foreground">{rupees(home.earnings.monthTotal)}</span> earned
        </p>
      </header>

      {home.active.length > 0 && (
        <section aria-labelledby="active" className="grid gap-3">
          <h2 id="active" className="text-xl font-semibold tracking-[-0.02em]">Current work</h2>
          <ul className="grid gap-3">
            {home.active.map((job) => <ActiveCard key={job.jobRef} job={job} />)}
          </ul>
        </section>
      )}

      <section aria-labelledby="new" className="grid gap-3">
        <h2 id="new" className="text-xl font-semibold tracking-[-0.02em]">New jobs {open.length > 0 && <span className="text-primary">({open.length})</span>}</h2>
        {open.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-white/60 p-6 text-muted-foreground">
            No new jobs right now. When a job comes up nearby, suvidha will call you and send a card on WhatsApp. It will show here too.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {open.map((invite) => <InviteCard key={invite.quoteRef} invite={invite} />)}
          </ul>
        )}
      </section>

      {sent.length > 0 && (
        <section aria-labelledby="sent" className="grid gap-3">
          <h2 id="sent" className="text-xl font-semibold tracking-[-0.02em]">Prices you sent</h2>
          <p className="-mt-1 text-sm text-muted-foreground">The customer compares prices and chooses. If you’re chosen, you get the address here and on WhatsApp.</p>
          <ul className="grid gap-2">
            {sent.map((i) => (
              <li key={i.quoteRef} className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{i.title}</p>
                  <p className="text-sm text-muted-foreground">{i.locality ?? "Area not given"}</p>
                </div>
                <p className="shrink-0 text-right text-sm font-medium tabular-nums">{i.myQuote && myQuoteText(i.myQuote)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {closed.length > 0 && (
        <section aria-labelledby="closed" className="grid gap-2">
          <h2 id="closed" className="text-base font-semibold text-muted-foreground">Closed</h2>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {closed.map((i) => (
              <li key={i.quoteRef}>{i.title} · {i.locality ?? "—"} · {i.myQuote ? "went to someone else" : "time to send a price ran out"}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ActiveCard({ job }: { job: ActiveJob }) {
  return (
    <li>
      <Link href={`/worker/jobs/${encodeURIComponent(job.jobRef)}`} className="grid gap-3 rounded-2xl bg-primary p-5 text-primary-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white/80">{STAGE[job.stage].label} · #{job.jobRef}</p>
            <p className="text-xl font-semibold tracking-[-0.02em]">{job.title}</p>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0" aria-hidden="true" />
        </div>
        <p className="flex items-start gap-1.5 text-white/90"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{job.address ?? "Address not given yet"}</p>
        <p className="rounded-xl bg-white/12 px-3 py-2 text-sm">{STAGE[job.stage].next}</p>
      </Link>
    </li>
  );
}

function InviteCard({ invite }: { invite: Invite }) {
  return (
    <li className="grid gap-3 rounded-2xl border bg-white p-5">
      <div className="grid gap-0.5">
        <p className="text-sm text-muted-foreground">{TRADE[invite.trade] ?? "Job"} · #{invite.jobRef}</p>
        <p className="text-xl font-semibold tracking-[-0.02em]">{invite.title}</p>
      </div>
      {invite.problem && <p>{invite.problem}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 text-primary" aria-hidden="true" />
          {invite.locality ?? "Area not given"}{invite.distanceKm !== null && ` · ${invite.distanceKm.toFixed(1)} km`}
        </span>
        <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-primary" aria-hidden="true" />{invite.when}</span>
        {invite.material && <span className="text-muted-foreground">{JOB_MATERIAL[invite.material] ?? invite.material}</span>}
      </div>
      {invite.safetyNote && (
        <p className="flex items-start gap-2 rounded-lg bg-[color-mix(in_oklab,var(--sun)_18%,white)] px-3 py-2 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{invite.safetyNote}
        </p>
      )}
      <Link href={`/worker/quote/${encodeURIComponent(invite.quoteRef)}`} className={cn(buttonVariants(), "h-12 rounded-xl text-base")}>
        Send price
      </Link>
    </li>
  );
}
