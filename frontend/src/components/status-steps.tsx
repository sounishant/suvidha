import { Check } from "lucide-react";
import type { JobStatus } from "@/lib/api";
import { STEPS, stepOf } from "@/lib/job-text";
import { cn } from "@/lib/utils";

export function StatusSteps({ status }: { status: JobStatus }) {
  const now = stepOf(status);
  const stopped = status === "cancelled" || status === "no_workers";
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Kaam kahan tak pahuncha">
      {STEPS.map((step, i) => {
        const done = !stopped && (i < now || status === "done");
        const current = !stopped && i === now && status !== "done";
        return (
          <li key={step} className="grid gap-2" aria-current={current ? "step" : undefined}>
            <span className={cn("h-1.5 rounded-full", done || current ? "bg-primary" : "bg-border")} />
            <span className={cn("flex items-center gap-1 text-xs leading-tight sm:text-sm", done || current ? "text-foreground" : "text-muted-foreground")}>
              {done && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
