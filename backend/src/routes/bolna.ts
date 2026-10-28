import express, { type RequestHandler } from "express";
import { z } from "zod";
import type { FnReply } from "../core/context.ts";
import { toE164 } from "../core/phone.ts";
import { cleanRef } from "../core/refs.ts";
import { requireBearer, requireHeader } from "../http/auth.ts";
import { bolnaCallId, logWebhook, type SaveWebhook } from "../http/webhook-log.ts";
import { say } from "../messages.ts";
import type { Services } from "../services.ts";

// Bolna fills parameters from the conversation, so any of them can arrive missing, empty or as a number.
const text = z.preprocess((v) => (v == null ? "" : String(v)), z.string().trim());
const yes = text.transform((v) => /^(yes|y|true|haan?|हाँ|हां)$/i.test(v));
const ref = text.transform(cleanRef);
const lang = text.transform((v) => v.toLowerCase() || "hi");

const RegisterWorker = z.object({
  caller_ref: ref, name: text, trades: text, skills: text, areas: text, working_hours: text,
  has_smartphone: yes, language: lang, consent_ai_calls: yes,
});
const Lookup = z.object({ contact_number: text, execution_id: text });
const CallWebhook = z.object({
  id: z.string(),
  status: z.string(),
  conversation_duration: z.coerce.number().optional().catch(undefined),
  total_cost: z.coerce.number().optional().catch(undefined),
  transcript: z.string().optional().catch(undefined),
  extracted_data: z.unknown().optional(),
  context_details: z.object({ recipient_data: z.object({ caller_ref: z.string().optional() }).passthrough().optional() }).passthrough().nullish().catch(undefined),
});

type Deps = {
  functionToken: string;
  webhookToken: string;
  saveWebhook: SaveWebhook;
  services: Services;
  background: (task: () => Promise<void>) => void;
  log: (line: string) => void;
};

export function bolnaRouter(deps: Deps) {
  const router = express.Router();
  const raw = express.raw({ type: () => true, limit: "2mb" });
  const fnAuth = requireBearer(deps.functionToken);
  const { services } = deps;

  // Every function answers 200 with flat JSON; on failure the agent says `say` and ends the call.
  function fn<T extends z.ZodType>(name: string, schema: T, run: (input: z.infer<T>) => Promise<FnReply>) {
    const handler: RequestHandler = async (req, res) => {
      const input = schema.safeParse(req.body ?? {});
      const language = (req.body as { language?: unknown } | undefined)?.language;
      const sayError = () => say(typeof language === "string" ? language : "hi", "error");
      if (!input.success) {
        deps.log(`${name}: bad input ${input.error.message}`);
        res.json({ ok: false, say: sayError() });
        return;
      }
      try {
        res.json(await run(input.data));
      } catch (err) {
        deps.log(`${name} failed: ${(err as Error).stack ?? err}`);
        res.json({ ok: false, say: sayError() });
      }
    };
    router.post(`/fn/${name}`, raw, fnAuth, logWebhook(deps.saveWebhook, "bolna_fn"), handler);
  }

  fn("register_worker", RegisterWorker, (b) =>
    services.registerWorker({
      callerRef: b.caller_ref, name: b.name, trades: b.trades, skills: b.skills, areas: b.areas,
      workingHours: b.working_hours, hasSmartphone: b.has_smartphone, language: b.language, consent: b.consent_ai_calls,
    }),
  );

  const lookup = (find: Services["lookupCustomer"]): RequestHandler => async (req, res) => {
    const q = Lookup.parse(req.query);
    res.json(await find({ phone: toE164(q.contact_number), executionId: q.execution_id || null }));
  };
  router.get("/lookup/customer", fnAuth, logWebhook(deps.saveWebhook, "bolna_lookup"), lookup(services.lookupCustomer));
  router.get("/lookup/worker", fnAuth, logWebhook(deps.saveWebhook, "bolna_lookup"), lookup(services.lookupWorker));

  // The job card and worker quotes arrive here, in Bolna's extraction once each call has ended.
  router.post(
    "/webhook/call",
    raw,
    requireHeader("x-suvidha-token", deps.webhookToken),
    logWebhook(deps.saveWebhook, "bolna_call", bolnaCallId),
    (req, res) => {
      res.json({ ok: true });
      const call = CallWebhook.safeParse(req.body);
      if (!call.success) return;
      const { context_details, ...rest } = call.data;
      deps.background(() => services.callStatus({ ...rest, caller_ref: context_details?.recipient_data?.caller_ref }));
    },
  );

  return router;
}
