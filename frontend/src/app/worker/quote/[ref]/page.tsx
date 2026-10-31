import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Clock, MapPin, TriangleAlert } from "lucide-react";
import { JobPhoto } from "@/components/job-photo";
import { QuoteForm } from "@/components/worker/quote-form";
import { TRADE } from "@/lib/job-text";
import { workerHome } from "@/lib/session";
import { JOB_MATERIAL, myQuoteText } from "@/lib/worker-text";

export const metadata: Metadata = { title: "Send price · suvidha" };

export default function QuotePage({ params }: PageProps<"/worker/quote/[ref]">) {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <Link href="/worker" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft className="size-4" aria-hidden="true" /> Jobs
      </Link>
      <Suspense fallback={<div className="h-96 rounded-2xl border bg-white" aria-busy="true" aria-label="Loading job" />}>
        <Quote params={params} />
      </Suspense>
    </div>
  );
}

async function Quote({ params }: Pick<PageProps<"/worker/quote/[ref]">, "params">) {
  const { ref } = await params;
  const home = await workerHome();
  const invite = home.invites.find((i) => i.quoteRef === ref);
  if (!invite) notFound();

  return (
    <>
      <section className="grid gap-3 rounded-2xl border bg-white p-5 sm:p-6">
        <p className="text-sm text-muted-foreground">{TRADE[invite.trade] ?? "Job"} · #{invite.jobRef}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">{invite.title}</h1>
        {invite.problem && <p className="text-lg">{invite.problem}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-primary" aria-hidden="true" />
            {invite.locality ?? "Area not given"}{invite.distanceKm !== null && ` · ${invite.distanceKm.toFixed(1)} km`}
          </span>
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-primary" aria-hidden="true" />{invite.when}</span>
        </div>
        {invite.material && <p className="text-muted-foreground">{JOB_MATERIAL[invite.material] ?? invite.material}</p>}
        {invite.safetyNote && (
          <p className="flex items-start gap-2 rounded-lg bg-[color-mix(in_oklab,var(--sun)_18%,white)] px-3 py-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{invite.safetyNote}
          </p>
        )}
        {invite.photoUrl && <JobPhoto url={invite.photoUrl} alt={`Customer’s photo of the job: ${invite.title}`} />}
        {invite.notes.length > 0 && (
          <div className="grid gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Customer added</h2>
            <ul className="grid gap-2">{invite.notes.map((n, i) => <li key={i} className="rounded-lg bg-muted px-3 py-2">{n}</li>)}</ul>
          </div>
        )}
        <p className="text-sm text-muted-foreground">You get the full address and the customer’s name once you’re booked.</p>
      </section>

      {invite.state === "open" ? (
        <section aria-label="Your price" className="rounded-2xl border bg-white p-5 sm:p-6">
          <QuoteForm quoteRef={invite.quoteRef} />
        </section>
      ) : (
        <p className="rounded-2xl border bg-white p-5 text-lg">
          {invite.myQuote ? `Your answer: ${myQuoteText(invite.myQuote)}.` : "The time to send a price for this job is over."}
          {invite.state === "sent" ? " The customer is choosing." : ""}
        </p>
      )}
    </>
  );
}
