import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startApp } from "./helpers.ts";

let app: ReturnType<typeof startApp>;
beforeEach(() => {
  app = startApp();
});
afterEach(() => app.close());

const post = (path: string, body?: object) =>
  fetch(`${app.url}/demo${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

describe("website demo routes", () => {
  it("start a demo with a token for the visitor's made-up number and Bolna's session", async () => {
    const res = await post("/start");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = (await res.json()) as { token: string; session: object };
    expect(body.token).toMatch(/^910012345678\.[\w-]{22}$/);
    expect(body.session).toEqual({ run_id: "web-1" });
  });

  it("answer only a token the backend signed", async () => {
    const { token } = (await (await post("/start")).json()) as { token: string };
    expect((await fetch(`${app.url}/demo/${token}/feed`)).status).toBe(200);
    expect((await fetch(`${app.url}/demo/910012345679.${token.split(".")[1]}/feed`)).status).toBe(404);
    expect((await post(`/910012345678.forged/reply`, { text: "hi" })).status).toBe(404);
  });

  it("pass a tap or a typed reply to the core for the visitor's number", async () => {
    const { token } = (await (await post("/start")).json()) as { token: string };
    expect((await post(`/${token}/reply`, { choice: "book:AB12", label: "Choose worker" })).status).toBe(200);
    expect((await post(`/${token}/reply`, {})).status).toBe(400);
    expect(app.calls.find((c) => c.name === "demoReply")?.input).toEqual({ phone: "+910012345678", reply: { choice: "book:AB12", label: "Choose worker" } });
  });
});
