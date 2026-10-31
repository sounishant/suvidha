import { say } from "../messages.ts";
import { skillsFor, toTrade, type Trade } from "./catalogue.ts";
import type { Ctx, FnReply } from "./context.ts";

export type NewWorker = {
  callerRef: string;
  name: string;
  trades: string;
  skills: string;
  areas: string;
  workingHours: string;
  hasSmartphone: boolean;
  language: string;
  consent: boolean;
};

const list = (text: string) => text.split(/,|;|\band\b|\bऔर\b/).map((s) => s.trim()).filter(Boolean);

// Workers join unverified: the team checks their ID, sets their hours and location, then verifies them.
export async function registerWorker(ctx: Ctx, input: NewWorker): Promise<FnReply> {
  if (!input.consent) return { ok: false, say: say(input.language, "consent_required") };
  const [caller] = await ctx.sql<{ phone: string }[]>`
    select phone from caller_refs where ref = ${input.callerRef} and line = 'worker'`;
  if (!caller) return { ok: false, say: say(input.language, "unknown_ref") };

  const named = [...new Set(list(input.trades).map(toTrade))];
  const trades: Trade[] = named.length > 1 ? named.filter((t) => t !== "other") : named.length ? named : ["other"];
  const areas = list(input.areas);

  const inserted = await ctx.sql`
    insert into workers ${ctx.sql({
      name: input.name,
      phone: caller.phone,
      trades,
      skills: trades.flatMap(skillsFor),
      skills_text: input.skills || null,
      locality: areas[0] ?? "",
      areas,
      working_hours: input.workingHours || null,
      language: input.language,
      has_smartphone: input.hasSmartphone,
      ai_call_consent_at: ctx.now(),
    })}
    on conflict (phone) do nothing
    returning id`;
  return { ok: true, next_step_text: say(input.language, inserted.length ? "registered" : "already_registered") };
}
