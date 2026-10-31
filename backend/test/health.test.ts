import { afterEach, describe, expect, it } from "vitest";
import type { AppDeps } from "../src/app.ts";
import { startApp } from "./helpers.ts";

let close: (() => void) | undefined;
afterEach(() => close?.());

async function getHealth(deps: Partial<AppDeps>) {
  const app = startApp(deps);
  close = app.close;
  const res = await fetch(`${app.url}/health`);
  return { status: res.status, body: await res.json() };
}

describe("GET /health", () => {
  it("reports ok when the database answers", async () => {
    const { status, body } = await getHealth({ pingDb: async () => 1, version: "abc123" });
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, db: "up", version: "abc123" });
  });

  it("reports 503 when the database is unreachable", async () => {
    const { status, body } = await getHealth({
      pingDb: () => Promise.reject(new Error("connection refused")),
      version: "abc123",
    });
    expect(status).toBe(503);
    expect(body).toEqual({ ok: false, db: "down", version: "abc123" });
  });
});
