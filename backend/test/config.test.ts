import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  it("treats NULL placeholders as missing", () => {
    expect(() => loadConfig({ DATABASE_URL: "NULL" })).toThrow();
  });

  it("applies defaults and coerces the port", () => {
    const config = loadConfig({ DATABASE_URL: "postgres://x", PORT: "3000" });
    expect(config).toEqual({ DATABASE_URL: "postgres://x", PORT: 3000, RAILWAY_GIT_COMMIT_SHA: "dev" });
  });
});
