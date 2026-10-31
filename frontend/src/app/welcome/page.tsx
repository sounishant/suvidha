import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { NameForm } from "@/components/name-form";

export const metadata: Metadata = { title: "Swagat hai · suvidha" };

export default function WelcomePage() {
  return (
    <main className="flex min-h-svh flex-col bg-muted px-5 py-6 sm:px-10">
      <Logo />
      <div className="mx-auto my-auto w-full max-w-sm py-12">
        <p className="text-sm font-medium text-primary">Number verify ho gaya</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.035em]">suvidha mein swagat hai</h1>
        <p className="mt-3 text-lg text-muted-foreground">Bas ek cheez: hum aapko kis naam se bulayein?</p>
        <div className="mt-8 rounded-2xl border bg-white p-6 sm:p-7">
          <NameForm next="/account" submitLabel="Aage badhiye" />
        </div>
      </div>
    </main>
  );
}
