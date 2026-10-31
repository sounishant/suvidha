import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { OpenJobCard } from "@/components/open-job-card";
import { backend, type JobSummary } from "@/lib/api";
import { STATUS, TRADE, rupees } from "@/lib/job-text";
import { requireCustomer } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings · suvidha" };

const dateText = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export default function BookingsPage({ searchParams }: PageProps<"/account/bookings">) {
  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Bookings</h1>
      <Suspense fallback={<div className="h-64 rounded-2xl border bg-white" aria-busy="true" aria-label="Bookings load ho rahi hain" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: Pick<PageProps<"/account/bookings">, "searchParams">) {
  const { tab } = await searchParams;
  const past = tab === "past";
  const { token } = await requireCustomer();
  const { data } = await backend<{ jobs: JobSummary[] }>("/customer/jobs", { token });
  const open = data.jobs.filter((j) => STATUS[j.status].open);
  const done = data.jobs.filter((j) => !STATUS[j.status].open);
  const shown = past ? done : open;

  return (
    <div className="grid gap-5">
      <nav aria-label="Bookings" className="inline-flex w-fit rounded-xl bg-white p-1 ring-1 ring-border">
        {[
          { href: "/account/bookings", label: `Chal rahe (${open.length})`, on: !past },
          { href: "/account/bookings?tab=past", label: `Pichhle (${done.length})`, on: past },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.on ? "page" : undefined}
            className={cn("rounded-lg px-4 py-2 text-base font-medium", t.on ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6">
          <p className="text-lg font-medium">{past ? "Abhi tak koi pichhla kaam nahi." : "Abhi koi kaam chal nahi raha."}</p>
          <p className="mt-1 text-muted-foreground">Naya kaam? Home pe service chuniye, ya call kijiye.</p>
          <Link href="/account" className="mt-4 inline-flex items-center gap-1 font-medium text-primary">
            Home pe jaiye <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      ) : past ? (
        <ul className="divide-y rounded-2xl border bg-white">
          {shown.map((job) => (
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
      ) : (
        <div className="grid gap-4">{shown.map((job) => <OpenJobCard key={job.ref} job={job} />)}</div>
      )}
    </div>
  );
}
