import { afterEach, describe, expect, it } from "vitest";
import { runWebhookChecks } from "../simulator/webhook-checks.ts";
import { secrets, startApp } from "./helpers.ts";

let close: (() => void) | undefined;
afterEach(() => close?.());

describe("simulator webhook checks", () => {
  it("passes every check against the app", async () => {
    const app = startApp();
    close = app.close;
    const checks = await runWebhookChecks({ baseUrl: app.url, secrets });
    expect(checks.filter((c) => !c.pass)).toEqual([]);
    expect(app.log.entries.map((e) => e.source)).toEqual([
      "bolna_lookup", "bolna_lookup", "bolna_fn", "bolna_fn",
      "bolna_call", "bolna_call", "bolna_call", "whatsapp", "whatsapp",
    ]);
  });
});
