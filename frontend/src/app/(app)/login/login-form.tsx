"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { cn } from "@/lib/utils";
import { sendCode, verifyCode, type LoginState, type Role } from "./actions";

// WhatsApp copies the code with its bold markers (*123456*); keep only the digits.
const digitsOnly = (text: string) => text.replace(/\D/g, "");

const START: LoginState = { step: "phone", phone: "", name: "", error: null };

export function LoginForm({ role }: { role: Role }) {
  const [sent, askCode, sending] = useActionState(sendCode, START);
  const [checked, checkCode, checking] = useActionState(verifyCode, START);
  const [signup, setSignup] = useState(false);

  if (sent.step === "phone") {
    return (
      <div className="grid gap-6">
        {role === "customer" && (
          <div role="tablist" aria-label="Log in or sign up" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {[
              { label: "Log in", on: !signup },
              { label: "Sign up", on: signup },
            ].map((tab, i) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={tab.on}
                onClick={() => setSignup(i === 1)}
                className={cn("h-11 rounded-lg text-base font-medium", tab.on ? "bg-white text-foreground shadow-sm" : "text-muted-foreground")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <form action={askCode} className="grid gap-5">
          <input type="hidden" name="role" value={role} />
          {signup && (
            <div className="grid gap-2">
              <label htmlFor="name" className="text-base font-medium">Your name</label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                maxLength={60}
                defaultValue={sent.name}
                placeholder="e.g. Kavita Sharma"
                className="h-14 rounded-xl bg-white px-4 text-lg"
                autoFocus
                required
              />
            </div>
          )}
          <div className="grid gap-2">
            <label htmlFor="phone" className="text-base font-medium">Mobile number</label>
            <div className="flex h-14 items-center rounded-xl border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
              <span className="pl-4 pr-2 text-lg text-muted-foreground">+91</span>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={14}
                defaultValue={sent.phone}
                placeholder="98XXX XXXXX"
                aria-invalid={sent.error ? true : undefined}
                aria-describedby={sent.error ? "phone-error" : "phone-help"}
                className="h-full border-0 bg-transparent text-lg shadow-none focus-visible:ring-0"
                required
              />
            </div>
            {sent.error ? (
              <p id="phone-error" className="text-sm text-destructive" role="alert">{sent.error}</p>
            ) : (
              <p id="phone-help" className="text-sm text-muted-foreground">
                {role === "worker" ? "The number you registered with suvidha. " : ""}We’ll send a 6-digit code to this number on WhatsApp.
              </p>
            )}
          </div>
          <Button type="submit" disabled={sending} className="h-14 rounded-xl text-lg">
            {sending ? "Sending…" : "Send code"}
          </Button>
        </form>
      </div>
    );
  }

  const error = checked.phone === sent.phone ? checked.error : null;
  return (
    <div className="grid gap-5">
      <form action={checkCode} className="grid gap-5">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="phone" value={sent.phone} />
        <input type="hidden" name="name" value={sent.name} />
        <div className="grid gap-3">
          <label htmlFor="code" className="text-base font-medium">Code from WhatsApp</label>
          <p className="text-sm text-muted-foreground">Sent to +91 {sent.phone.slice(0, 5)} {sent.phone.slice(5)}</p>
          <InputOTP pattern={REGEXP_ONLY_DIGITS} pasteTransformer={digitsOnly} id="code" name="code" maxLength={6} inputMode="numeric" autoComplete="one-time-code" autoFocus aria-invalid={error ? true : undefined}>
            <InputOTPGroup className="gap-1.5 sm:gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="size-11 rounded-xl border text-xl font-semibold first:rounded-xl last:rounded-xl sm:size-14" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <Button type="submit" disabled={checking} className="h-14 rounded-xl text-lg">
          {checking ? "Checking…" : sent.name ? "Create account" : "Log in"}
        </Button>
      </form>
      <div className="flex justify-between text-sm">
        <form action={askCode}>
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="phone" value={sent.phone} />
          {sent.name && <input type="hidden" name="name" value={sent.name} />}
          <button type="submit" className="font-medium text-primary underline-offset-4 hover:underline" disabled={sending}>
            Get a new code
          </button>
        </form>
        <a href={role === "worker" ? "/login/worker" : "/login"} className="text-muted-foreground underline-offset-4 hover:underline">Change number</a>
      </div>
    </div>
  );
}
