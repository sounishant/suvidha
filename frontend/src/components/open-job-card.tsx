import Link from "next/link";
import { StatusSteps } from "@/components/status-steps";
import { buttonVariants } from "@/components/ui/button";
import type { JobSummary } from "@/lib/api";
import { STATUS, TRADE } from "@/lib/job-text";
import { cn } from "@/lib/utils";

export function OpenJobCard({ job }: { job: JobSummary }) {
  const text = STATUS[job.status];
  const urgent = job.status === "quotes_in" || job.status === "awaiting_payment" || job.status === "booked";
  return (
    <article className="grid gap-5 rounded-2xl border bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-primary">{text.label}</p>
          <h3 className="text-2xl font-semibold tracking-[-0.025em]">{job.title}</h3>
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
      <Link href={`/account/jobs/${job.ref}`} className={cn(buttonVariants({ variant: urgent ? "default" : "secondary" }), "h-12 rounded-xl text-base")}>
        {job.status === "quotes_in" ? "Daam dekhiye aur chuniye" : job.status === "awaiting_payment" ? "Booking fee pay kijiye" : job.status === "booked" ? "Start code dekhiye" : "Poori jaankari"}
      </Link>
    </article>
  );
}
