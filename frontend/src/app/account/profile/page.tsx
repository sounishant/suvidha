import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut, MessageCircle, Phone } from "lucide-react";
import { NameForm } from "@/components/name-form";
import { Button } from "@/components/ui/button";
import { CALL, whatsappLink } from "@/lib/contact";
import { customerProfile } from "@/lib/session";
import { logout } from "../actions";

export const metadata: Metadata = { title: "Account · suvidha" };

export default function ProfilePage() {
  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Account</h1>
      <Suspense fallback={<div className="h-56 rounded-2xl border bg-white" aria-busy="true" aria-label="Loading account" />}>
        <Details />
      </Suspense>

      <section aria-labelledby="help" className="grid gap-1 rounded-2xl border bg-white p-2">
        <h2 id="help" className="px-4 pb-1 pt-3 text-sm font-medium text-muted-foreground">Help</h2>
        <a href={CALL.tel} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium hover:bg-muted">
          <Phone className="size-5 text-primary" aria-hidden="true" /> Call us · {CALL.label}
        </a>
        <a href={whatsappLink("Hello suvidha, I need help.")} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium hover:bg-muted">
          <MessageCircle className="size-5 text-primary" aria-hidden="true" /> Message us on WhatsApp
        </a>
      </section>

      <form action={logout}>
        <Button type="submit" variant="outline" className="h-12 w-full rounded-xl text-base text-destructive">
          <LogOut className="size-4" aria-hidden="true" /> Log out
        </Button>
      </form>
    </div>
  );
}

async function Details() {
  const profile = await customerProfile();
  return (
    <section aria-labelledby="me" className="grid gap-6 rounded-2xl border bg-white p-6">
      <div className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-2xl font-semibold text-white" aria-hidden="true">
          {(profile.name ?? "?").charAt(0).toUpperCase()}
        </span>
        <div>
          <h2 id="me" className="text-xl font-semibold">{profile.name ?? "No name yet"}</h2>
          <p className="text-muted-foreground tabular-nums">+91 {profile.phone.slice(3, 8)} {profile.phone.slice(8)}</p>
        </div>
      </div>
      <NameForm next={null} defaultName={profile.name ?? ""} submitLabel="Save name" />
    </section>
  );
}
