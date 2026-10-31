import type { Metadata } from "next";
import Image from "next/image";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login · suvidha" };

export default function LoginPage() {
  return (
    <main className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col bg-muted px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto my-auto w-full max-w-sm py-12">
          <h1 className="text-4xl font-semibold tracking-[-0.035em]">Shuru kijiye</h1>
          <p className="mt-3 text-lg text-muted-foreground">Login ya naya account, dono isi se. Booking, daam aur kaarigar ka code, sab ek jagah.</p>
          <div className="mt-8 rounded-2xl border bg-white p-6 sm:p-7">
            <LoginForm />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Naye hain? Number aur code se account apne aap ban jayega. Seedha booking chahiye?{" "}
            <a href="tel:+910000000000" className="font-medium text-primary">98XXX XXXXX</a> pe call kijiye.
          </p>
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
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.03em]">Ghar ka har kaam, ek call door.</p>
          <p className="mt-3 text-sm text-white/80">Photo: Fredericknoronha, CC BY-SA 4.0, Wikimedia Commons</p>
        </div>
      </section>
    </main>
  );
}
