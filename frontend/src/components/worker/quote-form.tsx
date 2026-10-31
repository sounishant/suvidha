"use client";

import { useActionState, useState } from "react";
import { sendQuote, type FormState } from "@/app/worker/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ARRIVAL, DECLINE } from "@/lib/worker-text";

const PRICE_TYPES = [
  { value: "fixed", label: "Pakka daam" },
  { value: "visit_only", label: "Dekh ke batayenge" },
] as const;

const MATERIAL = [
  { value: "yes", label: "Daam mein shaamil" },
  { value: "partly", label: "Kuch shaamil" },
  { value: "no", label: "Alag se" },
] as const;

export function QuoteForm({ quoteRef }: { quoteRef: string }) {
  const [state, action, pending] = useActionState(sendQuote.bind(null, quoteRef), { error: null } as FormState);
  const [available, setAvailable] = useState<"yes" | "no">("yes");
  const [priceType, setPriceType] = useState<(typeof PRICE_TYPES)[number]["value"]>("fixed");

  return (
    <form action={action} className="grid gap-6">
      <Choice legend="Ye kaam kar payenge?" name="available" value={available} onChange={(v) => setAvailable(v as "yes" | "no")}
        options={[{ value: "yes", label: "Haan, kar dunga" }, { value: "no", label: "Nahi" }]} />

      {available === "no" ? (
        <Choice legend="Kyon nahi?" name="declineReason" options={DECLINE} defaultValue="busy" />
      ) : (
        <>
          <Choice legend="Daam kaisa hai?" name="priceType" value={priceType} onChange={(v) => setPriceType(v as typeof priceType)} options={PRICE_TYPES} />

          {priceType === "visit_only" ? (
            <Rupees name="visitCharge" label="Aane ka charge (visit)" hint="Dekh ke kaam ka daam baad mein batayenge. Khaali chhodiye agar visit free hai." />
          ) : (
            <Rupees name="price" label="Aapka daam" hint="Customer yahi daam dekhega. Kaam ke baad isse zyada mat maangiye." required />
          )}

          <Choice legend="Saaman ka kharcha" name="materialIncluded" options={MATERIAL} defaultValue="no" />
          <Choice legend="Kitni der mein pahunchenge?" name="arrivalInMinutes" options={ARRIVAL.map((a) => ({ value: String(a.minutes), label: a.label }))} defaultValue="60" />
        </>
      )}

      <div className="grid gap-2">
        <label htmlFor="note" className="text-base font-medium">Customer ke liye kuch kehna hai? <span className="font-normal text-muted-foreground">(zaroori nahi)</span></label>
        <Input id="note" name="note" maxLength={200} placeholder="Jaise: naya washer lagana padega" className="h-12 rounded-xl bg-white px-4 text-base" />
      </div>

      {state.error && <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive" role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending} className="h-14 rounded-xl text-lg">
        {pending ? "Bhej rahe hain…" : available === "yes" ? "Daam bhejiye" : "Mana kijiye"}
      </Button>
    </form>
  );
}

type Option = { value: string; label: string };

function Choice({ legend, name, options, value, defaultValue, onChange }: {
  legend: string;
  name: string;
  options: readonly Option[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-base font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              className="peer sr-only"
              {...(onChange ? { checked: value === o.value, onChange: () => onChange(o.value) } : { defaultChecked: defaultValue === o.value })}
            />
            <span className={cn(
              "inline-flex h-12 items-center rounded-xl border bg-white px-4 text-base",
              "peer-checked:border-primary peer-checked:bg-secondary peer-checked:font-medium peer-checked:text-accent-foreground",
              "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40",
            )}>
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Rupees({ name, label, hint, required }: { name: string; label: string; hint?: string; required?: boolean }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={name} className="text-base font-medium">{label}</label>
      <div className="flex h-14 items-center rounded-xl border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
        <span className="pl-4 pr-1 text-lg text-muted-foreground">₹</span>
        <Input id={name} name={name} inputMode="numeric" pattern="[0-9]*" maxLength={6} required={required} placeholder="0"
          aria-describedby={hint ? `${name}-hint` : undefined}
          className="h-full border-0 bg-transparent text-lg tabular-nums shadow-none focus-visible:ring-0" />
      </div>
      {hint && <p id={`${name}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
