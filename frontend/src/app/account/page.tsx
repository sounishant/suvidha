import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Phone } from "lucide-react";
import { StatusSteps } from "@/components/status-steps";
import { buttonVariants } from "@/components/ui/button";
import { backend, type JobSummary } from "@/lib/api";
import { STATUS, TRADE, rupees } from "@/lib/job-text";
import { requireCustomer } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Aapke kaam · suvidha" };

const dateText = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export default function AccountPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Jobs />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Aapke kaam load ho rahe hain">
      <div className="mt-1 h-10 w-48 rounded-lg bg-border/60" />
      <div className="h-64 rounded-2xl border bg-white" />
    </div>
  );
}

async function Jobs() {
  const { token, phone } = await requireCustomer();
  const { data } = await backend<{ jobs: JobSummary[] }>("/customer/jobs", { token });
  const open = data.jobs.filter((j) => STATUS[j.status].open);
  const past = data.jobs.filter((j) => !STATUS[j.status].open);

  return (
    <div className="grid gap-10">
      <section aria-labelledby="now" className="grid gap-4">
        <p className="text-sm text-muted-foreground">+91 {phone.slice(3, 8)} {phone.slice(8)}</p>
        <h1 id="now" className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Aapke kaam</h1>
        {open.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6">
            <p className="text-lg font-medium">Abhi koi kaam chal nahi raha.</p>
            <p className="mt-1 text-muted-foreground">Kuch kharab hai? Call kijiye, problem batayiye. Teen kaarigar apna daam bhejenge.</p>
            <a href="tel:+910000000000" className={cn(buttonVariants(), "mt-5 h-12 rounded-xl px-5 text-base")}>
              <Phone className="size-4" aria-hidden="true" />
              Call kijiye · 98XXX XXXXX
            </a>
          </div>
        ) : (
          open.map((job) => <OpenJob key={job.ref} job={job} />)
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past" className="grid gap-3">
          <h2 id="past" className="text-xl font-semibold tracking-[-0.02em]">Pichhle kaam</h2>
          <ul className="divide-y rounded-2xl border bg-white">
            {past.map((job) => (
              <li key={job.ref}>
                <Link href={`/account/jobs/${job.ref}`} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/60">
                  <span className="grid flex-1 gap-0.5">
                    <span className="font-medium">{job.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {TRADE[job.trade] ?? "Kaarigar"}
                      {job.worker ? ` · ${job.worker}` : ""} · {dateText(job.createdAt)}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <span className="block font-medium tabular-nums">{job.price !== null ? rupees(job.price) : "—"}</span>
                    <span className="text-muted-foreground">{STATUS[job.status].label}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function OpenJob({ job }: { job: JobSummary }) {
  const text = STATUS[job.status];
  return (
    <article className="grid gap-5 rounded-2xl border bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-primary">{text.label}</p>
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">{job.title}</h2>
          <p className="text-muted-foreground">
            {TRADE[job.trade] ?? "Kaarigar"}
            {job.locality ? ` · ${job.locality}` : ""} · {job.when}
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">#{job.ref}</span>
      </div>
      <StatusSteps status={job.status} />
      <p className="text-base">{text.line}</p>
      {job.worker && (
        <p className="rounded-xl bg-muted px-4 py-3">
          <span className="font-medium">{job.worker}</span> aa rahe hain{job.eta ? `, ${job.eta} tak` : ""}.
        </p>
      )}
      <Link
        href={`/account/jobs/${job.ref}`}
        className={cn(buttonVariants({ variant: job.status === "quotes_in" || job.status === "booked" ? "default" : "secondary" }), "h-12 rounded-xl text-base")}
      >
        {job.status === "quotes_in" ? "Daam dekhiye aur chuniye" : job.status === "booked" ? "Start code dekhiye" : "Poori jaankari"}
      </Link>
    </article>
  );
}
