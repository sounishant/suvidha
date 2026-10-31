import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, MapPin, MessageCircle, Phone, Wallet } from "lucide-react";
import { OpenJobCard } from "@/components/open-job-card";
import { ServiceIcon } from "@/components/service-icon";
import { buttonVariants } from "@/components/ui/button";
import { backend, type JobSummary } from "@/lib/api";
import { CALL, SERVICES, whatsappLink } from "@/lib/contact";
import { STATUS, TRADE, rupees } from "@/lib/job-text";
import { customerProfile, requireCustomer } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Home · suvidha" };

export default function HomePage() {
  return (
    <div className="grid gap-10">
      <Suspense fallback={<div className="h-28 rounded-2xl bg-border/50" aria-busy="true" aria-label="Loading" />}>
        <Greeting />
      </Suspense>

      <section aria-labelledby="services" className="grid gap-4">
        <h2 id="services" className="text-xl font-semibold tracking-[-0.02em]">What needs fixing?</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SERVICES.map((s) => (
            <li key={s.slug}>
              <Link href={`/account/book/${s.slug}`} className="group grid h-full gap-3 rounded-2xl border bg-white p-4 transition-colors hover:border-primary sm:p-5">
                <span className="grid size-12 place-items-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <ServiceIcon slug={s.slug} className="size-6" />
                </span>
                <span className="grid gap-0.5">
                  <span className="text-lg font-semibold">{s.name}</span>
                  <span className="text-sm text-muted-foreground">{s.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Suspense fallback={null}>
        <PastWorkers />
      </Suspense>

      <section aria-labelledby="how" className="grid gap-4 rounded-2xl bg-primary p-5 text-white sm:p-7">
        <h2 id="how" className="text-xl font-semibold tracking-[-0.02em]">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ["Call or WhatsApp us", "Tell us what’s broken, in your own words."],
            ["Get three prices", "Nearby workers send their price and time. You choose."],
            ["Start with a code", "Give the worker the start code when they arrive. Not fixed? We redo it free."],
          ].map(([title, line], i) => (
            <li key={title} className="grid grid-cols-[auto_1fr] gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-white text-sm font-semibold text-primary tabular-nums">{i + 1}</span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="text-sm text-white/80">{line}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="help" className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:p-6">
        <div>
          <h2 id="help" className="text-lg font-semibold">Need help?</h2>
          <p className="text-muted-foreground">Talk to our team about any booking.</p>
        </div>
        <a href={CALL.tel} className={cn(buttonVariants(), "h-12 rounded-xl px-5 text-base")}>
          <Phone className="size-4" aria-hidden="true" /> Call us
        </a>
        <a href={whatsappLink("Hello suvidha, I need help.")} className={cn(buttonVariants({ variant: "secondary" }), "h-12 rounded-xl px-5 text-base")}>
          <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
        </a>
      </section>
    </div>
  );
}

async function Greeting() {
  const { token } = await requireCustomer();
  const [profile, { data }] = await Promise.all([customerProfile(), backend<{ jobs: JobSummary[] }>("/customer/jobs", { token })]);
  const open = data.jobs.filter((j) => STATUS[j.status].open);
  const first = profile.name?.split(" ")[0];

  return (
    <section aria-labelledby="hello" className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="hello" className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Hello{first ? `, ${first}` : ""}</h1>
          <p className="mt-1 text-muted-foreground">What needs fixing today?</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.credit > 0 && (
            <Link href="/account/profile" className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-secondary px-3 py-1.5 text-sm font-medium text-accent-foreground">
              <Wallet className="size-4 text-primary" aria-hidden="true" /> {rupees(profile.credit)} credit
            </Link>
          )}
          <p className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-sm font-medium">
            <MapPin className="size-4 text-primary" aria-hidden="true" /> Roorkee
          </p>
        </div>
      </div>
      {open.length > 0 && (
        <div className="grid gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">In progress</h2>
          <OpenJobCard job={open[0]!} />
          {open.length > 1 && (
            <Link href="/account/bookings" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary">
              {open.length - 1} more in progress <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

async function PastWorkers() {
  const { token } = await requireCustomer();
  const { data } = await backend<{ jobs: JobSummary[] }>("/customer/jobs", { token });
  const seen = new Set<string>();
  const workers = data.jobs
    .filter((j) => j.status === "done" && j.worker)
    .filter((j) => (seen.has(j.worker!) ? false : (seen.add(j.worker!), true)))
    .slice(0, 4);
  if (workers.length === 0) return null;

  return (
    <section aria-labelledby="workers" className="grid gap-4">
      <div>
        <h2 id="workers" className="text-xl font-semibold tracking-[-0.02em]">Your workers</h2>
        <p className="text-sm text-muted-foreground">Liked their work? Book them again.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {workers.map((j) => {
          const trade = TRADE[j.trade] ?? "Worker";
          return (
            <li key={j.worker} className="flex items-center gap-4 rounded-2xl border bg-white p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-lg font-semibold text-primary" aria-hidden="true">
                {j.worker!.charAt(0)}
              </span>
              <span className="grid flex-1">
                <span className="font-semibold">{j.worker}</span>
                <span className="text-sm text-muted-foreground">{trade} · {j.title}</span>
              </span>
              <a
                href={whatsappLink(`Hello suvidha, I’d like ${j.worker} (${trade}) again.`)}
                className={cn(buttonVariants({ variant: "secondary" }), "h-11 rounded-xl px-4 text-sm")}
              >
                Book again
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
