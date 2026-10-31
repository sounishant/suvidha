import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { rupees } from "@/lib/job-text";
import { workerHome } from "@/lib/session";

export const metadata: Metadata = { title: "Kamai · suvidha" };

const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

export default function EarningsPage() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Kamai</h1>
      <Suspense fallback={<div className="h-72 rounded-2xl border bg-white" aria-busy="true" aria-label="Kamai load ho rahi hai" />}>
        <Earnings />
      </Suspense>
    </div>
  );
}

async function Earnings() {
  const { earnings, recent } = await workerHome();
  return (
    <>
      <section aria-label="Kul kamai" className="grid grid-cols-2 gap-3">
        <div className="grid gap-1 rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="text-sm text-white/80">Is mahine</p>
          <p className="text-3xl font-semibold tabular-nums tracking-[-0.03em]">{rupees(earnings.monthTotal)}</p>
          <p className="text-sm text-white/80">{earnings.monthJobs} kaam</p>
        </div>
        <div className="grid gap-1 rounded-2xl border bg-white p-5">
          <p className="text-sm text-muted-foreground">Ab tak</p>
          <p className="text-3xl font-semibold tabular-nums tracking-[-0.03em]">{rupees(earnings.total)}</p>
          <p className="text-sm text-muted-foreground">{earnings.jobs} kaam</p>
        </div>
      </section>
      <p className="-mt-2 text-sm text-muted-foreground">Ye wo daam hai jo aapne kaam band karte waqt daala.</p>

      <section aria-labelledby="recent" className="grid gap-3">
        <h2 id="recent" className="text-xl font-semibold tracking-[-0.02em]">Pichhle kaam</h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-white/60 p-6 text-muted-foreground">Abhi koi kaam band nahi hua. Pehla kaam band hote hi yahan dikhega.</p>
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
