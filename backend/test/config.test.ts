import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const secrets = {
  BOLNA_FUNCTION_TOKEN: "f".repeat(32),
  BOLNA_WEBHOOK_TOKEN: "w".repeat(32),
  WHATSAPP_APP_SECRET: "app-secret",
  WHATSAPP_VERIFY_TOKEN: "verify-me",
  APP_API_TOKEN: "a".repeat(32),
};

describe("loadConfig", () => {
  it("treats NULL placeholders as missing", () => {
    expect(() => loadConfig({ ...secrets, DATABASE_URL: "NULL" })).toThrow();
    expect(() => loadConfig({ ...secrets, DATABASE_URL: "postgres://x", BOLNA_FUNCTION_TOKEN: "NULL" })).toThrow();
  });

  it("applies defaults and coerces the port", () => {
    const config = loadConfig({ ...secrets, DATABASE_URL: "postgres://x", PORT: "3000" });
    expect(config).toEqual({
      ...secrets, DATABASE_URL: "postgres://x", PORT: 3000, RAILWAY_GIT_COMMIT_SHA: "dev",
      TICK_SEC: 3, WHATSAPP_API_VERSION: "v26.0", INVITE_DELAY_SEC: 60, PARALLEL_CALLS: 2, MAX_WORKER_CALLS: 6,
      QUOTES_WANTED: 3, CALL_TIMEOUT_SEC: 300, EXTRACTION_WAIT_SEC: 120, CUSTOMER_LINE_MODE: "live",
    });
  });
});
