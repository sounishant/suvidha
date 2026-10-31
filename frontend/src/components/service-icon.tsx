import { BrickWall, Hammer, PaintRoller, Snowflake, Wrench, Zap, type LucideIcon } from "lucide-react";
import type { ServiceSlug } from "@/lib/contact";

const ICONS: Record<ServiceSlug, LucideIcon> = {
  plumber: Wrench,
  electrician: Zap,
  carpenter: Hammer,
  painter: PaintRoller,
  ac: Snowflake,
  mason: BrickWall,
};

export function ServiceIcon({ slug, className }: { slug: ServiceSlug; className?: string }) {
  const Icon = ICONS[slug];
  return <Icon className={className} aria-hidden="true" strokeWidth={1.8} />;
}
