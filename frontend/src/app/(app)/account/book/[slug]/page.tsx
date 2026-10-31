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
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">{service.name}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{service.hint}. Tell us what’s broken and three nearby workers will send you their price.</p>
        </div>
        <div className="grid gap-3">
          <a href={CALL.tel} className={cn(buttonVariants(), "h-14 rounded-xl text-lg")}>
            <Phone className="size-5" aria-hidden="true" /> Call · {CALL.label}
          </a>
          <a href={whatsappLink(`Hello suvidha, ${service.ask}.`)} className={cn(buttonVariants({ variant: "secondary" }), "h-14 rounded-xl text-lg")}>
            <MessageCircle className="size-5" aria-hidden="true" /> Tell us on WhatsApp
          </a>
        </div>
      </section>

      <section aria-labelledby="tips" className="grid gap-3 rounded-2xl bg-white/70 p-6">
        <h2 id="tips" className="text-lg font-semibold">Keep this ready for the call</h2>
        <ul className="grid gap-2 text-base text-muted-foreground">
          <li>What’s broken, in your own words. For example: “the kitchen tap is dripping”.</li>
          <li>When it needs to be fixed by.</li>
          <li>Your address and a landmark nearby.</li>
          <li>If you can, send a photo on WhatsApp afterwards.</li>
        </ul>
        <p className="text-sm text-muted-foreground">Priya, our AI voice, answers the call and reads everything back to you.</p>
      </section>
    </div>
  );
}
