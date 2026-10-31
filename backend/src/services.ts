import { endSession, sessionFor, startLogin, verifyLogin, type Role, type Session } from "./core/app-login.ts";
import { recordCallStatus, type CallStatus } from "./core/calls.ts";
import type { Ctx, FnReply } from "./core/context.ts";
import { bookForCustomer, customerJob, customerJobs } from "./core/customer-app.ts";
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
  startLogin(input: { phone: string; role: Role }): ReturnType<typeof startLogin>;
  verifyLogin(input: { phone: string; role: Role; code: string }): ReturnType<typeof verifyLogin>;
  session(token: string): Promise<Session | null>;
  endSession(sessionId: string): Promise<void>;
  customerJobs(session: Session): ReturnType<typeof customerJobs>;
  customerJob(session: Session, ref: string): ReturnType<typeof customerJob>;
  bookForCustomer(session: Session, jobRef: string, quoteRef: string): Promise<boolean>;
};

export function coreServices(ctx: Ctx): Services {
  return {
    lookupCustomer: (caller) => lookupCustomer(ctx, caller),
    lookupWorker: (caller) => lookupWorker(ctx, caller),
    registerWorker: (input) => registerWorker(ctx, input),
    callStatus: (call) => recordCallStatus(ctx, call),
    whatsappEvent: (body) => handleWhatsApp(ctx, body),
    startLogin: (input) => startLogin(ctx, input),
    verifyLogin: (input) => verifyLogin(ctx, input),
    session: (token) => sessionFor(ctx, token),
    endSession: (sessionId) => endSession(ctx, sessionId),
    customerJobs: (session) => customerJobs(ctx, session),
    customerJob: (session, ref) => customerJob(ctx, session, ref),
    bookForCustomer: (session, jobRef, quoteRef) => bookForCustomer(ctx, session, jobRef, quoteRef),
  };
}
