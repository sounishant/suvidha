import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import { ServiceIcon } from "@/components/service-icon";
import { buttonVariants } from "@/components/ui/button";
import { CALL, SERVICES, whatsappLink } from "@/lib/contact";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Booking · suvidha" };

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export default function BookPage({ params }: PageProps<"/account/book/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-xl rounded-2xl border bg-white" aria-busy="true" />}>
      <Book params={params} />
    </Suspense>
  );
}

async function Book({ params }: Pick<PageProps<"/account/book/[slug]">, "params">) {
  const { slug } = await params;
  const service = SERVICES.find((s) => s.slug === slug);
  if (!service) notFound();

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <Link href="/account" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary">
        <ArrowLeft className="size-4" aria-hidden="true" /> Home
      </Link>

      <section className="grid gap-5 rounded-2xl border bg-white p-6 sm:p-8">
        <span className="grid size-16 place-items-center rounded-2xl bg-secondary text-primary">
          <ServiceIcon slug={service.slug} className="size-8" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">{service.name} chahiye?</h1>
          <p className="mt-2 text-lg text-muted-foreground">{service.hint}. Batayiye kya kharab hai, teen paas ke kaarigar apna daam bhejenge.</p>
        </div>
        <div className="grid gap-3">
          <a href={CALL.tel} className={cn(buttonVariants(), "h-14 rounded-xl text-lg")}>
            <Phone className="size-5" aria-hidden="true" /> Call kijiye · {CALL.label}
          </a>
          <a href={whatsappLink(`Namaste suvidha, ${service.ask}.`)} className={cn(buttonVariants({ variant: "secondary" }), "h-14 rounded-xl text-lg")}>
            <MessageCircle className="size-5" aria-hidden="true" /> WhatsApp pe bataiye
          </a>
        </div>
      </section>

      <section aria-labelledby="tips" className="grid gap-3 rounded-2xl bg-white/70 p-6">
        <h2 id="tips" className="text-lg font-semibold">Call pe ye taiyaar rakhiye</h2>
        <ul className="grid gap-2 text-base text-muted-foreground">
          <li>Kya kharab hai, apne shabdon mein. Jaise: “kitchen ka nal tapak raha hai”.</li>
          <li>Kab tak theek hona chahiye.</li>
          <li>Ghar ka pata aur paas ka koi landmark.</li>
          <li>Ho sake to baad mein WhatsApp pe ek photo bhejiye.</li>
        </ul>
        <p className="text-sm text-muted-foreground">Priya, hamari AI awaaz, call uthayegi aur sab dohra ke sunayegi.</p>
      </section>
    </div>
  );
}
