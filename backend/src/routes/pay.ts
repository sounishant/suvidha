import express from "express";
import type { Services } from "../services.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const page = (body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Suvidha payment (test)</title>
<style>body{font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 16px;color:#1a1a1a;background:#fff}
button{font-size:18px;padding:12px 20px;width:100%;border:0;border-radius:8px;background:#0b6e4f;color:#fff}
.note{color:#666;font-size:14px}</style></head><body>${body}</body></html>`;

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Stands in for the payment provider's checkout until one is chosen; anyone with the link can pay it.
export function payRouter(services: Pick<Services, "paymentView" | "payBooking">) {
  const router = express.Router();

  const expired = page("<h2>This link has expired</h2><p>Choose the worker again from the WhatsApp list.</p>");
  const view = async (id: string) => (UUID.test(id) ? services.paymentView(id) : null);

  router.get("/:id", async (req, res) => {
    const v = await view(req.params.id);
    if (!v) return void res.status(404).send(page("<h2>Link not found</h2>"));
    if (v.status === "paid") return void res.send(page("<h2>Already paid</h2><p>Check WhatsApp for your booking.</p>"));
    if (v.status === "expired") return void res.send(expired);
    res.send(page(`<h2>Booking fee ₹${v.amountInr}</h2>
<p>${escape(v.job)} with ${escape(v.worker)}</p>
<form method="post"><button type="submit">Pay ₹${v.amountInr}</button></form>
<p class="note">Test payment: no money is taken.</p>`));
  });

  router.post("/:id", async (req, res) => {
    const v = await view(req.params.id);
    if (!v) return void res.status(404).send(page("<h2>Link not found</h2>"));
    if (v.status === "paid") return void res.send(page("<h2>Already paid</h2><p>Check WhatsApp for your booking.</p>"));
    const outcome = v.status === "pending" ? await services.payBooking(req.params.id) : "expired";
    res.send(outcome === "paid" ? page("<h2>Paid</h2><p>Your booking is confirmed. Check WhatsApp for the OTP.</p>") : expired);
  });

  return router;
}
