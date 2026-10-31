import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { secrets, startApp } from "./helpers.ts";

let app: ReturnType<typeof startApp>;
beforeEach(() => {
  app = startApp();
});
afterEach(() => app.close());

const appToken = { "x-app-token": secrets.APP_API_TOKEN };
const signedIn = { ...appToken, authorization: "Bearer good" };

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

  it("book through the shared core function", async () => {
    expect((await call("POST", "/customer/jobs/MINE/book", signedIn, {})).status).toBe(400);
    const res = await call("POST", "/customer/jobs/MINE/book", signedIn, { quoteRef: "Q7K2" });
    expect(await res.json()).toEqual({ ok: true });
    expect(app.calls.at(-1)).toEqual({ name: "bookForCustomer", input: expect.objectContaining({ id: "s1" }) });
  });
});
