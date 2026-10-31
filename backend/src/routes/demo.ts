import { createHmac } from "node:crypto";
import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import { sameSecret } from "../http/auth.ts";
import type { Services } from "../services.ts";

type Deps = { secret: string; services: Services; log: (line: string) => void };

const Reply = z.union([
  z.object({ choice: z.string().trim().min(1).max(60), label: z.string().trim().min(1).max(80) }),
  z.object({ text: z.string().trim().min(1).max(500) }),
]);

const sign = (secret: string, phone: string) => createHmac("sha256", secret).update(`demo:${phone}`).digest("base64url").slice(0, 22);

// The website calls these straight from the browser. A signed token names the visitor's made-up number,
// so a visitor sees only their own demo; the daily cap in startDemo bounds the cost.
export function demoRouter({ secret, services, log }: Deps) {
  const router = Router();
  router.use((req, res, next) => {
    res.set({ "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST" });
    if (req.method === "OPTIONS") return void res.sendStatus(204);
    next();
  });

  router.post("/start", async (_req, res) => {
    try {
      const started = await services.demoStart();
      if (!started.ok) return void res.status(503).json(started);
      const token = `${started.phone.slice(1)}.${sign(secret, started.phone)}`;
      res.json({ ok: true, token, session: started.session });
    } catch (err) {
      log(`demo start failed: ${(err as Error).message}`);
      res.status(502).json({ ok: false, reason: "closed" });
    }
  });

  const visitor: RequestHandler = (req, res, next) => {
    const [digits = "", mac = ""] = String(req.params.token).split(".");
    const phone = `+${digits}`;
    if (!/^\d{12}$/.test(digits) || !sameSecret(mac, sign(secret, phone))) return void res.sendStatus(404);
    res.locals.phone = phone;
    next();
  };

  router.get("/:token/feed", visitor, async (req, res) => {
    const after = Number(req.query.after) || 0;
    res.json(await services.demoFeed(res.locals.phone as string, after));
  });

  router.post("/:token/reply", visitor, express.json({ limit: "4kb" }), async (req, res) => {
    const reply = Reply.safeParse(req.body);
    if (!reply.success) return void res.sendStatus(400);
    await services.demoReply(res.locals.phone as string, reply.data);
    res.json({ ok: true });
  });

  return router;
}
