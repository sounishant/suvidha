import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { Session } from "../core/app-login.ts";
import { requireHeader } from "../http/auth.ts";
import type { BookingStep, Services } from "../services.ts";

type Deps = { appToken: string; services: Services };

const Phone = z.string().trim().min(10).max(20);
const Role = z.enum(["customer", "worker"]);
const Start = z.object({ phone: Phone, role: Role });
const Verify = z.object({ phone: Phone, role: Role, code: z.string().trim().max(10) });
const Book = z.object({ quoteRef: z.string().trim().min(1).max(20) });
const Profile = z.object({ name: z.string().trim().min(1).max(60) });
const Rupees = z.number().int().min(0).max(100_000);
const Quote = z
  .object({
    available: z.boolean(),
    declineReason: z.enum(["busy", "too_far", "not_my_skill", "other"]).nullable().default(null),
    priceType: z.enum(["fixed", "visit_only"]).nullable().default(null),
    price: Rupees.nullable().default(null),
    visitCharge: Rupees.nullable().default(null),
    materialIncluded: z.enum(["yes", "no", "partly"]).nullable().default(null),
    arrivalInMinutes: z.number().int().min(0).max(7 * 24 * 60).nullable().default(null),
    note: z.string().trim().max(200).nullable().default(null),
  })
  .refine((q) => !q.available || (q.priceType !== null && (q.priceType === "visit_only" || q.price !== null) && q.arrivalInMinutes !== null));
const Code = z.object({ code: z.string().regex(/^\d{4}$/) });
const Done = z.object({ finalPrice: Rupees.nullable().default(null) });

const session = (res: express.Response) => res.locals.session as Session;

// Only the Next.js server calls these (it holds the app token); each customer route also needs a session token.
export function appRouter({ appToken, services }: Deps) {
  const router = Router();
  router.use(requireHeader("x-app-token", appToken), express.json({ limit: "10kb" }));

  const signedIn: RequestHandler = async (req, res, next) => {
    const token = (req.get("authorization") ?? "").replace(/^Bearer /, "");
    const found = token ? await services.session(token) : null;
    if (!found) return res.status(401).json({ ok: false, error: "signed_out" });
    res.locals.session = found;
    next();
  };
  const customer: RequestHandler = (_req, res, next) =>
    session(res).role === "customer" ? next() : res.status(403).json({ ok: false, error: "not_a_customer" });
  const worker: RequestHandler = (_req, res, next) =>
    session(res).role === "worker" ? next() : res.status(403).json({ ok: false, error: "not_a_worker" });

  router.post("/auth/start", async (req, res) => {
    const input = Start.safeParse(req.body);
    if (!input.success) return res.status(400).json({ ok: false, error: "invalid_phone" });
    const reply = await services.startLogin(input.data);
    res.status(reply.ok ? 200 : reply.error === "too_many_codes" ? 429 : 400).json(reply);
  });

  router.post("/auth/verify", async (req, res) => {
    const input = Verify.safeParse(req.body);
    if (!input.success) return res.status(400).json({ ok: false, error: "wrong_code" });
    const reply = await services.verifyLogin(input.data);
    res.status(reply.ok ? 200 : 401).json(reply);
  });

  router.post("/auth/logout", signedIn, async (_req, res) => {
    await services.endSession(session(res).id);
    res.json({ ok: true });
  });

  router.get("/me", signedIn, (_req, res) => {
    const { phone, role } = session(res);
    res.json({ ok: true, phone, role });
  });

  router.get("/customer/profile", signedIn, customer, async (_req, res) => {
    res.json({ ok: true, profile: await services.customerProfile(session(res)) });
  });

  router.post("/customer/profile", signedIn, customer, async (req, res) => {
    const input = Profile.safeParse(req.body);
    if (!input.success) return res.status(400).json({ ok: false, error: "invalid_name" });
    await services.setCustomerName(session(res), input.data.name);
    res.json({ ok: true });
  });

  router.get("/customer/jobs", signedIn, customer, async (_req, res) => {
    res.json({ ok: true, jobs: await services.customerJobs(session(res)) });
  });

  router.get("/customer/jobs/:ref", signedIn, customer, async (req, res) => {
    const job = await services.customerJob(session(res), String(req.params.ref));
    if (!job) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, job });
  });

  router.post("/customer/jobs/:ref/book", signedIn, customer, async (req, res) => {
    const input = Book.safeParse(req.body);
    if (!input.success) return res.status(400).json({ ok: false, error: "bad_request" });
    const booked = await services.bookForCustomer(session(res), String(req.params.ref), input.data.quoteRef);
    res.status(booked ? 200 : 409).json(booked ? { ok: true } : { ok: false, error: "not_bookable" });
  });

  router.get("/worker/home", signedIn, worker, async (_req, res) => {
    res.json({ ok: true, ...(await services.workerHome(session(res))) });
  });

  router.post("/worker/online", signedIn, worker, async (req, res) => {
    const input = z.object({ online: z.boolean() }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ ok: false, error: "bad_request" });
    await services.setOnline(session(res), input.data.online);
    res.json({ ok: true });
  });

  router.post("/worker/quotes/:ref", signedIn, worker, async (req, res) => {
    const input = Quote.safeParse(req.body);
    if (!input.success) return res.status(400).json({ ok: false, error: "invalid_quote" });
    const saved = await services.quoteFromApp(session(res), String(req.params.ref), input.data);
    res.status(saved ? 200 : 409).json(saved ? { ok: true } : { ok: false, error: "not_open" });
  });

  const step = (kind: "trip" | "start" | "done" | "finish"): RequestHandler => async (req, res) => {
    const body = kind === "start" || kind === "finish" ? Code.safeParse(req.body) : kind === "done" ? Done.safeParse(req.body) : { success: true as const, data: {} };
    if (!body.success) return res.status(400).json({ ok: false, error: kind === "done" ? "bad_request" : "wrong_code" });
    const reply = await services.bookingStep(session(res), String(req.params.ref), { kind, ...body.data } as BookingStep);
    const status = reply.ok ? 200 : reply.error === "not_found" ? 404 : reply.error === "wrong_code" ? 400 : reply.error === "code_locked" ? 423 : 409;
    res.status(status).json(reply);
  };
  router.post("/worker/jobs/:ref/trip", signedIn, worker, step("trip"));
  router.post("/worker/jobs/:ref/start", signedIn, worker, step("start"));
  router.post("/worker/jobs/:ref/done", signedIn, worker, step("done"));
  router.post("/worker/jobs/:ref/finish", signedIn, worker, step("finish"));

  return router;
}
