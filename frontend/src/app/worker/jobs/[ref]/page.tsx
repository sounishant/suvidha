import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Check, CircleCheckBig, Clock, MapPin, Navigation, TriangleAlert, UserRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StepPanel } from "@/components/worker/step-panel";
import { TRADE, rupees } from "@/lib/job-text";
import { workerHome } from "@/lib/session";
import { cn } from "@/lib/utils";
import { STAGE, WORKER_STEPS, stepIndex } from "@/lib/worker-text";

export const metadata: Metadata = { title: "Current job · suvidha" };

export default function WorkerJobPage({ params }: PageProps<"/worker/jobs/[ref]">) {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <Link href="/worker" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft className="size-4" aria-hidden="true" /> Jobs
      </Link>
      <Suspense fallback={<div className="h-96 rounded-2xl border bg-white" aria-busy="true" aria-label="Loading job" />}>
        <Job params={params} />
      </Suspense>
    </div>
  );
}

async function Job({ params }: Pick<PageProps<"/worker/jobs/[ref]">, "params">) {
  const { ref } = await params;
  const home = await workerHome();
  const job = home.active.find((j) => j.jobRef === ref);

  if (!job) {
    const closed = home.recent.find((r) => r.jobRef === ref);
    if (!closed) notFound();
    return (
      <section className="grid justify-items-start gap-3 rounded-2xl border bg-white p-6">
        <CircleCheckBig className="size-10 text-primary" aria-hidden="true" />
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">Job closed</h1>
        <p className="text-lg">{closed.title} · #{closed.jobRef}{closed.price !== null && <> · <span className="font-semibold">{rupees(closed.price)}</span> added to your earnings</>}</p>
        <Link href="/worker" className={cn(buttonVariants(), "mt-2 h-12 rounded-xl px-5 text-base")}>See more jobs</Link>
      </section>
    );
  }

  const now = stepIndex(job.stage);
  const maps = job.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}` : null;

  return (
    <>
      <header className="grid gap-4 rounded-2xl border bg-white p-5 sm:p-6">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-primary">{STAGE[job.stage].label}</p>
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">{job.title}</h1>
          <p className="text-muted-foreground">{TRADE[job.trade] ?? "Job"} · #{job.jobRef}</p>
        </div>
        <ol className="grid grid-cols-4 gap-2" aria-label="Job progress">
          {WORKER_STEPS.map((step, i) => (
            <li key={step} className="grid gap-2" aria-current={i === now ? "step" : undefined}>
              <span className={cn("h-1.5 rounded-full", i <= now ? "bg-primary" : "bg-border")} />
              <span className={cn("flex items-center gap-1 text-xs leading-tight sm:text-sm", i <= now ? "text-foreground" : "text-muted-foreground")}>
                {i < now && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
                {step}
              </span>
            </li>
          ))}
        </ol>
      </header>

      <section aria-labelledby="next" className="grid gap-4 rounded-2xl border-2 border-primary bg-white p-5 sm:p-6">
        <h2 id="next" className="text-lg font-semibold">What to do now</h2>
        <p className="-mt-2 text-muted-foreground">{STAGE[job.stage].next}</p>
        <StepPanel job={job} />
      </section>

      <section aria-labelledby="details" className="grid gap-4 rounded-2xl border bg-white p-5 sm:p-6">
        <h2 id="details" className="text-lg font-semibold">Job details</h2>
        <ul className="grid gap-3">
          <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span className="font-medium">{job.address ?? "Address not given yet"}</span></li>
          {job.customer && <li className="flex items-start gap-2"><UserRound className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />{job.customer}</li>}
          <li className="flex items-start gap-2"><Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />{job.when}{job.eta && ` · you said you’d arrive ${job.eta}`}</li>
          {job.problem && <li className="rounded-lg bg-muted px-3 py-2">{job.problem}</li>}
          {job.safetyNote && (
            <li className="flex items-start gap-2 rounded-lg bg-[color-mix(in_oklab,var(--sun)_18%,white)] px-3 py-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{job.safetyNote}
            </li>
          )}
          {job.price !== null && (
            <li className="text-muted-foreground">Your price: <span className="font-medium text-foreground">{rupees(job.price)}</span></li>
          )}
        </ul>
        {maps && (
          <a href={maps} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "secondary" }), "h-12 rounded-xl text-base")}>
            <Navigation className="size-4" aria-hidden="true" /> Route on Google Maps
          </a>
        )}
        <p className="text-sm text-muted-foreground">Need to talk to the customer? Call the worker line and suvidha will connect you.</p>
      </section>
    </>
  );
}
