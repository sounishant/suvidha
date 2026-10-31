"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { sendCode, verifyCode, type LoginState } from "./actions";

const START: LoginState = { step: "phone", phone: "", error: null };

export function LoginForm() {
  const [sent, askCode, sending] = useActionState(sendCode, START);
  const [checked, checkCode, checking] = useActionState(verifyCode, START);

  if (sent.step === "phone") {
    return (
      <form action={askCode} className="grid gap-5">
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
            <p id="phone-error" className="text-sm text-destructive">{sent.error}</p>
          ) : (
            <p id="phone-help" className="text-sm text-muted-foreground">Isi number pe WhatsApp pe 6 ank ka code aayega.</p>
          )}
        </div>
        <Button type="submit" disabled={sending} className="h-14 rounded-xl text-lg">
          {sending ? "Bhej rahe hain…" : "Code bhejiye"}
        </Button>
      </form>
    );
  }

  const error = checked.phone === sent.phone ? checked.error : null;
  return (
    <div className="grid gap-5">
      <form action={checkCode} className="grid gap-5">
        <input type="hidden" name="phone" value={sent.phone} />
        <div className="grid gap-3">
          <label htmlFor="code" className="text-base font-medium">WhatsApp pe aaya code</label>
          <p className="text-sm text-muted-foreground">+91 {sent.phone.slice(0, 5)} {sent.phone.slice(5)} pe bheja gaya</p>
          <InputOTP id="code" name="code" maxLength={6} inputMode="numeric" autoComplete="one-time-code" autoFocus aria-invalid={error ? true : undefined}>
            <InputOTPGroup className="gap-1.5 sm:gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="size-11 rounded-xl border text-xl font-semibold first:rounded-xl last:rounded-xl sm:size-14" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
        <Button type="submit" disabled={checking} className="h-14 rounded-xl text-lg">
          {checking ? "Jaanch rahe hain…" : "Login kijiye"}
        </Button>
      </form>
      <div className="flex justify-between text-sm">
        <form action={askCode}>
          <input type="hidden" name="phone" value={sent.phone} />
          <button type="submit" className="font-medium text-primary underline-offset-4 hover:underline" disabled={sending}>
            Naya code mangaiye
          </button>
        </form>
        <a href="/login" className="text-muted-foreground underline-offset-4 hover:underline">Number badliye</a>
      </div>
    </div>
  );
}
