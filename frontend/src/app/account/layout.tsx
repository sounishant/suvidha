import { Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logout } from "./actions";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="min-h-svh bg-muted">
      <header className="sticky top-0 z-10 border-b bg-white/95">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Logo href="/account" />
          <div className="flex items-center gap-2">
            <a href="tel:+910000000000" className={cn(buttonVariants(), "h-11 rounded-xl px-4 text-base")}>
              <Phone className="size-4" aria-hidden="true" />
              Call kijiye
            </a>
            <form action={logout}>
              <Button type="submit" variant="ghost" className="h-11 rounded-xl px-3 text-base text-muted-foreground">
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        {children}
      </main>
    </div>
  );
}
