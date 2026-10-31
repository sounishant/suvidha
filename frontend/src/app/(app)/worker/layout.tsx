import { Phone } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Logo } from "@/components/logo";
import { TabBar } from "@/components/tab-bar";
import { buttonVariants } from "@/components/ui/button";
import { CALL } from "@/lib/contact";
import { cn } from "@/lib/utils";

export default function WorkerLayout({ children }: LayoutProps<"/worker">) {
  return (
    <div className="min-h-svh bg-muted">
      <header className="sticky top-0 z-10 border-b bg-white/95">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4">
          <Logo href="/worker" />
          <TabBar variant="top" area="worker" />
          <a href={CALL.tel} className={cn(buttonVariants({ variant: "secondary" }), "h-11 rounded-xl px-4 text-base")}>
            <Phone className="size-4" aria-hidden="true" />
            Help
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 sm:pb-16">{children}</main>
      <TabBar variant="bottom" area="worker" />
      <AutoRefresh />
    </div>
  );
}
