import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { rupees } from "@/lib/job-text";
import { workerHome } from "@/lib/session";

export const metadata: Metadata = { title: "Earnings · suvidha" };

const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export default function EarningsPage() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Earnings</h1>
      <Suspense fallback={<div className="h-72 rounded-2xl border bg-white" aria-busy="true" aria-label="Loading earnings" />}>
        <Earnings />
      </Suspense>
    </div>
  );
}

async function Earnings() {
  const { earnings, recent, travel } = await workerHome();
  return (
    <>
      <section aria-label="Total earnings" className="grid grid-cols-2 gap-3">
        <div className="grid gap-1 rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="text-sm text-white/80">This month</p>
          <p className="text-3xl font-semibold tabular-nums tracking-[-0.03em]">{rupees(earnings.monthTotal)}</p>
          <p className="text-sm text-white/80">{earnings.monthJobs} {earnings.monthJobs === 1 ? "job" : "jobs"}</p>
        </div>
        <div className="grid gap-1 rounded-2xl border bg-white p-5">
          <p className="text-sm text-muted-foreground">All time</p>
          <p className="text-3xl font-semibold tabular-nums tracking-[-0.03em]">{rupees(earnings.total)}</p>
          <p className="text-sm text-muted-foreground">{earnings.jobs} {earnings.jobs === 1 ? "job" : "jobs"}</p>
        </div>
      </section>
      <p className="-mt-2 text-sm text-muted-foreground">This is the final price you entered when closing each job.</p>

      <section aria-labelledby="travel" className="grid gap-3 rounded-2xl border bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="travel" className="text-lg font-semibold">Travel pay from suvidha</h2>
          <p className="shrink-0 text-right">
            <span className="block text-xl font-semibold tabular-nums">{rupees(earnings.travelTotal)}</span>
            <span className="text-sm text-muted-foreground tabular-nums">{rupees(earnings.travelMonth)} this month</span>
          </p>
        </div>
        <p className="text-sm text-muted-foreground">If a customer cancels after you’ve set out, suvidha pays you ₹25 for the trip.</p>
        {travel.length > 0 && (
          <ul className="divide-y">
            {travel.map((t) => (
              <li key={`${t.jobRef}-${t.paidAt}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground">{DAY.format(new Date(t.paidAt))} · #{t.jobRef}</p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{rupees(t.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent" className="grid gap-3">
        <h2 id="recent" className="text-xl font-semibold tracking-[-0.02em]">Past jobs</h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-white/60 p-6 text-muted-foreground">No jobs closed yet. Your first one will show here.</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-white">
            {recent.map((r) => (
              <li key={r.jobRef}>
                <Link href={`/worker/jobs/${encodeURIComponent(r.jobRef)}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-muted/60">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-sm text-muted-foreground">{DAY.format(new Date(r.closedAt))} · {r.locality ?? "—"}</p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{r.price !== null ? rupees(r.price) : "—"}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
