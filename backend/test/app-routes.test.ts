import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { secrets, startApp } from "./helpers.ts";

let app: ReturnType<typeof startApp>;
beforeEach(() => {
  app = startApp();
});
afterEach(() => app.close());

const appToken = { "x-app-token": secrets.APP_API_TOKEN };
const signedIn = { ...appToken, authorization: "Bearer good" };
const asWorker = { ...appToken, authorization: "Bearer worker" };

function call(method: string, path: string, headers: Record<string, string>, body?: object) {
  return fetch(`${app.url}/app${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("web app routes", () => {
  it("refuse every caller without the app token", async () => {
    expect((await call("POST", "/auth/start", {}, { phone: "9876543210", role: "customer" })).status).toBe(401);
    expect((await call("GET", "/customer/jobs", { authorization: "Bearer good" })).status).toBe(401);
    expect(app.calls).toHaveLength(0);
  });

  it("check the phone before asking the core for a code", async () => {
    expect((await call("POST", "/auth/start", appToken, { phone: "12", role: "customer" })).status).toBe(400);
    expect((await call("POST", "/auth/start", appToken, { phone: "9876543210", role: "team" })).status).toBe(400);
    const res = await call("POST", "/auth/start", appToken, { phone: "98765 43210", role: "customer" });
    expect(await res.json()).toEqual({ ok: true });
    expect(app.calls).toEqual([{ name: "startLogin", input: { phone: "98765 43210", role: "customer" } }]);
  });

  it("need a live session for customer data", async () => {
    expect((await call("GET", "/customer/jobs", { ...appToken, authorization: "Bearer expired" })).status).toBe(401);
    const res = await call("GET", "/customer/jobs", signedIn);
    expect(await res.json()).toEqual({ ok: true, jobs: [] });
  });

  it("answer 404 for a job that is not the customer's own", async () => {
    expect((await call("GET", "/customer/jobs/THEIRS", signedIn)).status).toBe(404);
    expect((await call("GET", "/customer/jobs/MINE", signedIn)).status).toBe(200);
  });

  it("save a name between 1 and 60 characters", async () => {
    expect((await call("POST", "/customer/profile", signedIn, { name: "  " })).status).toBe(400);
    expect((await call("POST", "/customer/profile", signedIn, { name: "Asha" })).status).toBe(200);
    expect(await (await call("GET", "/customer/profile", signedIn)).json()).toEqual({ ok: true, profile: { phone: "+919876543210", name: "Asha" } });
  });

  it("keep customers and workers to their own routes", async () => {
    expect((await call("GET", "/worker/home", signedIn)).status).toBe(403);
    expect((await call("GET", "/customer/jobs", asWorker)).status).toBe(403);
    expect((await call("GET", "/worker/home", asWorker)).status).toBe(200);
  });

  it("check a worker quote before saving it", async () => {
    const quote = { available: true, priceType: "fixed", price: 350, arrivalInMinutes: 60 };
    expect((await call("POST", "/worker/quotes/Q1", asWorker, { ...quote, price: null })).status).toBe(400);
    expect((await call("POST", "/worker/quotes/Q1", asWorker, { ...quote, arrivalInMinutes: null })).status).toBe(400);
    expect((await call("POST", "/worker/quotes/Q1", asWorker, { available: false, declineReason: "busy" })).status).toBe(200);
    expect((await call("POST", "/worker/quotes/Q1", asWorker, quote)).status).toBe(200);
  });

  it("only take a 4-digit code for the start and finish steps", async () => {
    expect((await call("POST", "/worker/jobs/J1/start", asWorker, { code: "12" })).status).toBe(400);
    expect((await call("POST", "/worker/jobs/J1/start", asWorker, { code: "1234" })).status).toBe(200);
    expect(app.calls.at(-1)).toEqual({ name: "bookingStep", input: { kind: "start", code: "1234" } });
    await call("POST", "/worker/jobs/J1/done", asWorker, { finalPrice: 400 });
    expect(app.calls.at(-1)).toEqual({ name: "bookingStep", input: { kind: "done", finalPrice: 400 } });
  });

  it("book through the shared core function", async () => {
    expect((await call("POST", "/customer/jobs/MINE/book", signedIn, {})).status).toBe(400);
    const res = await call("POST", "/customer/jobs/MINE/book", signedIn, { quoteRef: "Q7K2" });
    expect(await res.json()).toEqual({ ok: true });
    expect(app.calls.at(-1)).toEqual({ name: "bookForCustomer", input: expect.objectContaining({ id: "s1" }) });
  });
});
