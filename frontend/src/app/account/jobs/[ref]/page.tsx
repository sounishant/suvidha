import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, BadgeCheck, Clock, MapPin, Phone } from "lucide-react";
import { StatusSteps } from "@/components/status-steps";
import { Button, buttonVariants } from "@/components/ui/button";
import { backend, type Booking, type JobDetail, type Quote } from "@/lib/api";
import { MATERIAL, STATUS, TRADE, quotePrice, rupees } from "@/lib/job-text";
import { CALL } from "@/lib/contact";
import { requireCustomer } from "@/lib/session";
import { cn } from "@/lib/utils";
import { bookWorker } from "../../actions";

export const metadata: Metadata = { title: "Job · suvidha" };

export default function JobPage({ params, searchParams }: PageProps<"/account/jobs/[ref]">) {
  return (
    <Suspense fallback={<div className="mt-2 h-80 rounded-2xl border bg-white" aria-busy="true" aria-label="Loading job" />}>
      <Job params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Job({ params, searchParams }: Pick<PageProps<"/account/jobs/[ref]">, "params" | "searchParams">) {
  const { ref } = await params;
  const { book } = await searchParams;
  const { token } = await requireCustomer();
  const { status, data } = await backend<{ job: JobDetail }>(`/customer/jobs/${encodeURIComponent(ref)}`, { token });
  if (status === 404) notFound();
  const job = data.job;
  const text = STATUS[job.status];

  return (
    <div className="mt-2 grid gap-6">
      <Link href="/account/bookings" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft className="size-4" aria-hidden="true" /> Bookings
      </Link>

      <header className="grid gap-4 rounded-2xl border bg-white p-5 sm:p-6">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-primary">{text.label}</p>
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">{job.title}</h1>
          <p className="text-muted-foreground">
            {TRADE[job.trade] ?? "Worker"} · #{job.ref}
          </p>
        </div>
        <StatusSteps status={job.status} />
        <p>{text.line}</p>
      </header>

      {book === "failed" && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
          We couldn’t book this worker. Refresh the page, or call us.
        </p>
      )}

      {job.payment && (
        <section aria-labelledby="payment" className="grid gap-3 rounded-2xl border border-primary bg-white p-5 ring-2 ring-primary/15 sm:p-6">
          <h2 id="payment" className="text-lg font-semibold">Booking fee: {rupees(job.payment.amount)}</h2>
          <p className="text-muted-foreground">Your booking is confirmed as soon as the fee is paid, and you get the start code. You pay the worker’s price to them directly after the job.</p>
          <a href={job.payment.url} className={cn(buttonVariants(), "h-12 rounded-xl text-base")}>Pay booking fee</a>
        </section>
      )}

      {job.booking && <BookingCard booking={job.booking} />}

      {(job.status === "quotes_in" || job.status === "awaiting_payment") && job.quotes.length > 0 && (
        <section aria-labelledby="quotes" className="grid gap-3">
          <h2 id="quotes" className="text-xl font-semibold tracking-[-0.02em]">{job.quotes.length === 1 ? "1 price is in" : `${job.quotes.length} prices are in`}</h2>
          <p className="-mt-1 text-sm text-muted-foreground">The best match for what matters to you is on top.</p>
          <ol className="grid gap-3">
            {job.quotes.map((q, i) => (
              <QuoteCard key={q.ref} quote={q} top={i === 0} action={bookWorker.bind(null, job.ref, q.ref)} />
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="details" className="grid gap-3 rounded-2xl border bg-white p-5 sm:p-6">
        <h2 id="details" className="text-lg font-semibold">Job details</h2>
        <dl className="grid gap-3 text-base sm:grid-cols-[10rem_1fr]">
          {job.problem && <Row label="Problem">{job.problem}</Row>}
          <Row label="When">{job.when}</Row>
          {(job.address || job.locality) && <Row label="Address">{job.address ?? job.locality}</Row>}
          {job.material && <Row label="Material">{MATERIAL[job.material] ?? job.material}</Row>}
          {job.budget && <Row label="Budget">{rupees(job.budget)}</Row>}
          {job.safetyNote && <Row label="Take care">{job.safetyNote}</Row>}
        </dl>
        <p className="text-sm text-muted-foreground">Something wrong? Reply on WhatsApp and we’ll change it.</p>
      </section>

      <a href={CALL.tel} className={cn(buttonVariants({ variant: "secondary" }), "h-12 rounded-xl text-base")}>
        <Phone className="size-4" aria-hidden="true" /> Problem? Call us
      </a>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="-mt-2 font-medium sm:mt-0">{children}</dd>
    </>
  );
}

function QuoteCard({ quote, top, action }: { quote: Quote; top: boolean; action: () => Promise<void> }) {
  return (
    <li className={cn("grid gap-3 rounded-2xl border bg-white p-5", top && "border-primary ring-2 ring-primary/15")}>
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <p className="flex items-center gap-1.5 text-lg font-semibold">
            {quote.worker}
            {quote.verified && <BadgeCheck className="size-4 text-primary" aria-label="ID verified" />}
          </p>
          <p className="text-sm text-muted-foreground">
            {quote.rating !== null ? `Rating ${quote.rating.toFixed(1)}` : "New worker"}
            {quote.distanceKm !== null ? ` · ${quote.distanceKm.toFixed(1)} km away` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold tabular-nums">{quotePrice(quote)}</p>
          <p className="text-sm text-muted-foreground tabular-nums">+ {rupees(quote.fee)} booking fee</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {quote.arrives && (
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-primary" aria-hidden="true" />{quote.arrives}</span>
        )}
        {quote.materialIncluded && <span className="text-muted-foreground">{MATERIAL[quote.materialIncluded]}</span>}
      </div>
      {quote.reason && <p className="text-sm font-medium text-primary">{quote.reason}</p>}
      {quote.note && <p className="rounded-lg bg-muted px-3 py-2 text-sm">“{quote.note}”</p>}
      <form action={action}>
        <Button type="submit" variant={top ? "default" : "secondary"} className="h-12 w-full rounded-xl text-base">
          Book {quote.worker}
        </Button>
      </form>
    </li>
  );
}

const STAGE: Record<Booking["stage"], string> = {
  booked: "Booked",
  on_the_way: "On the way",
  working: "Working",
  done: "Work done",
  closed: "Completed",
};

function BookingCard({ booking }: { booking: Booking }) {
  const code = booking.finishCode ?? booking.startCode;
  return (
    <section aria-labelledby="booking" className="grid gap-5 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white/80">{STAGE[booking.stage]}</p>
          <h2 id="booking" className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.025em]">
            {booking.worker}
            {booking.verified && <BadgeCheck className="size-5" aria-label="ID verified" />}
          </h2>
          <p className="text-white/80">{booking.rating !== null ? `Rating ${booking.rating.toFixed(1)}` : "New worker"}</p>
        </div>
        {booking.eta && (
          <p className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm">
            <MapPin className="size-4" aria-hidden="true" /> {booking.eta}
          </p>
        )}
      </div>
      {code && (
        <div className="rounded-2xl bg-white p-5 text-foreground">
          <p className="text-sm text-muted-foreground">
            {booking.finishCode ? "Finish code: share it only if you’re happy with the work" : "Start code: share it when the worker arrives"}
          </p>
          <p className="mt-1 text-5xl font-semibold tracking-[0.2em] text-primary tabular-nums" aria-label={code.split("").join(" ")}>
            {code}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Tell this code only to the worker, face to face. Never over the phone.</p>
        </div>
      )}
      {booking.finalPrice !== null && <p>Final price: <span className="font-semibold tabular-nums">{rupees(booking.finalPrice)}</span></p>}
    </section>
  );
}
