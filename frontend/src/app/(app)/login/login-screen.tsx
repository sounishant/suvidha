import Link from "next/link";
import { LoginPhone } from "@/components/login-phone";
import { Logo } from "@/components/logo";
import { CALL } from "@/lib/contact";
import type { Role } from "./actions";
import { LoginForm } from "./login-form";

const COPY: Record<Role, { title: string; line: string }> = {
  customer: { title: "Get started", line: "Your bookings, prices and worker codes, all in one place." },
  worker: { title: "Worker login", line: "New jobs, your prices, current work and earnings, all in one place." },
};

export function LoginScreen({ role }: { role: Role }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col bg-muted px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto my-auto w-full max-w-sm py-12">
          <h1 className="text-4xl font-semibold tracking-[-0.035em]">{COPY[role].title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{COPY[role].line}</p>
          <div className="mt-8 rounded-2xl border bg-white p-6 sm:p-7">
            <LoginForm role={role} />
          </div>
          {role === "customer" ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Want to book right away? Call <a href={CALL.tel} className="font-medium text-primary">{CALL.label}</a>.
              <br />
              Are you a worker? <Link href="/login/worker" className="font-medium text-primary">Worker login</Link>
            </p>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Want to join suvidha? Call <a href={CALL.tel} className="font-medium text-primary">{CALL.label}</a>.
              <br />
              Are you a customer? <Link href="/login" className="font-medium text-primary">Customer login</Link>
            </p>
          )}
        </div>
      </section>
      <section className="hidden flex-col items-center justify-center gap-8 bg-primary px-10 py-12 lg:flex">
        <LoginPhone role={role} />
        <p className="max-w-md text-center text-3xl font-semibold leading-tight tracking-[-0.03em] text-white">
          {role === "customer" ? "Every home repair, one call away." : "Work nearby, at your price."}
        </p>
      </section>
    </main>
  );
}
