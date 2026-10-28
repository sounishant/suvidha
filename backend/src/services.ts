import { recordCallStatus, type CallStatus } from "./core/calls.ts";
import type { Ctx, FnReply } from "./core/context.ts";
import { lookupCustomer, lookupWorker } from "./core/lookup.ts";
import { handleWhatsApp } from "./core/whatsapp-events.ts";
import { registerWorker, type NewWorker } from "./core/workers.ts";

type Caller = { phone: string; executionId: string | null };

// What the HTTP layer needs from the core; tests swap in stubs to check routing without a database.
export type Services = {
  lookupCustomer(caller: Caller): Promise<object>;
  lookupWorker(caller: Caller): Promise<object>;
  registerWorker(input: NewWorker): Promise<FnReply>;
  callStatus(call: CallStatus): Promise<void>;
  whatsappEvent(body: unknown): Promise<void>;
};

export function coreServices(ctx: Ctx): Services {
  return {
    lookupCustomer: (caller) => lookupCustomer(ctx, caller),
    lookupWorker: (caller) => lookupWorker(ctx, caller),
    registerWorker: (input) => registerWorker(ctx, input),
    callStatus: (call) => recordCallStatus(ctx, call),
    whatsappEvent: (body) => handleWhatsApp(ctx, body),
  };
}
