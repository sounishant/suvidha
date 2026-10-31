import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { CALL } from "@/lib/contact";
import type { Role } from "./actions";
import { LoginForm } from "./login-form";

const COPY: Record<Role, { title: string; line: string }> = {
  customer: { title: "Shuru kijiye", line: "Booking, daam aur kaarigar ka code, sab ek jagah." },
  worker: { title: "Kaarigar login", line: "Naye kaam, daam bhejna, chal raha kaam aur aapki kamai, sab ek jagah." },
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
              Seedha booking chahiye? <a href={CALL.tel} className="font-medium text-primary">{CALL.label}</a> pe call kijiye.
              <br />
              Kaarigar hain? <Link href="/login/worker" className="font-medium text-primary">Kaarigar login</Link>
            </p>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              suvidha se judna hai? <a href={CALL.tel} className="font-medium text-primary">{CALL.label}</a> pe call kijiye.
              <br />
              Customer hain? <Link href="/login" className="font-medium text-primary">Customer login</Link>
            </p>
          )}
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-primary lg:block">
        <Image
          src="/img/electrician.jpg"
          alt="Ek electrician muskurate hue switch board ki wiring theek kar raha hai"
          fill
          priority
          sizes="55vw"
          className="object-cover object-[40%_70%] opacity-90 mix-blend-screen grayscale contrast-110"
        />
        <div className="absolute bottom-8 left-8 right-8 rounded-2xl bg-accent-foreground/95 p-7 text-white">
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.03em]">
            {role === "customer" ? "Ghar ka har kaam, ek call door." : "Paas ka kaam, aapka daam."}
          </p>
          <p className="mt-3 text-sm text-white/80">Photo: Fredericknoronha, CC BY-SA 4.0, Wikimedia Commons</p>
        </div>
      </section>
    </main>
  );
}
