import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, type AppDeps } from "../src/app.ts";

let close: (() => void) | undefined;
afterEach(() => close?.());

async function getHealth(deps: AppDeps) {
  const server = createApp(deps).listen(0);
  close = () => server.close();
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/health`);
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
