import type { Media } from "./clients/whatsapp.ts";
import { endSession, sessionFor, startLogin, verifyLogin, type Role, type Session } from "./core/app-login.ts";
import { payBooking, paymentView, type PaymentView } from "./core/bookings.ts";
import { recordCallStatus, type CallStatus } from "./core/calls.ts";
import type { Ctx, FnReply } from "./core/context.ts";
import { bookForCustomer, cancelForCustomer, customerJob, customerJobs, customerProfile, messageForJob, photoForJob, setCustomerName } from "./core/customer-app.ts";
import { lookupCustomer, lookupWorker } from "./core/lookup.ts";
import { handleWhatsApp } from "./core/whatsapp-events.ts";
import { cancelForWorker, finishJob, markDone, quoteFromApp, setOnline, startTrip, startWork, workerHome, type AppQuote, type StepReply } from "./core/worker-app.ts";
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
  bookForCustomer(session: Session, jobRef: string, quoteRef: string): ReturnType<typeof bookForCustomer>;
  customerProfile(session: Session): ReturnType<typeof customerProfile>;
  setCustomerName(session: Session, name: string): Promise<void>;
  messageForJob(session: Session, ref: string, text: string): ReturnType<typeof messageForJob>;
  photoForJob(session: Session, ref: string, media: Media): ReturnType<typeof photoForJob>;
  cancelForCustomer(session: Session, ref: string): Promise<boolean>;
  cancelForWorker(session: Session, ref: string): Promise<boolean>;
  workerHome(session: Session): ReturnType<typeof workerHome>;
  setOnline(session: Session, online: boolean): Promise<void>;
  quoteFromApp(session: Session, quoteRef: string, quote: AppQuote): Promise<boolean>;
  bookingStep(session: Session, jobRef: string, step: BookingStep): Promise<StepReply>;
  paymentView(paymentId: string): Promise<PaymentView | null>;
  payBooking(paymentId: string): Promise<"paid" | "expired">;
};

export type BookingStep =
  | { kind: "trip" }
  | { kind: "start"; code: string }
  | { kind: "done"; finalPrice: number | null }
  | { kind: "finish"; code: string };

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
    customerProfile: (session) => customerProfile(ctx, session),
    setCustomerName: (session, name) => setCustomerName(ctx, session, name),
    messageForJob: (session, ref, text) => messageForJob(ctx, session, ref, text),
    photoForJob: (session, ref, media) => photoForJob(ctx, session, ref, media),
    cancelForCustomer: (session, ref) => cancelForCustomer(ctx, session, ref),
    cancelForWorker: (session, ref) => cancelForWorker(ctx, session, ref),
    workerHome: (session) => workerHome(ctx, session),
    setOnline: (session, online) => setOnline(ctx, session, online),
    quoteFromApp: (session, quoteRef, quote) => quoteFromApp(ctx, session, quoteRef, quote),
    bookingStep: (session, jobRef, step) =>
      step.kind === "trip" ? startTrip(ctx, session, jobRef)
      : step.kind === "start" ? startWork(ctx, session, jobRef, step.code)
      : step.kind === "done" ? markDone(ctx, session, jobRef, step.finalPrice)
      : finishJob(ctx, session, jobRef, step.code),
    paymentView: (id) => paymentView(ctx, id),
    payBooking: (id) => payBooking(ctx, id),
  };
}
