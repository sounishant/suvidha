import { describe, expect, it } from "vitest";
import { skillsFor } from "../src/core/catalogue.ts";
import { DemoPhones, seedStats, seedWorkers } from "../src/db/seed.ts";

const phones = ["+919000000001", "+919000000002", "+919000000003"];

describe("seed workers", () => {
  it("seeds Nishant, Kalpana and Sanskar on the demo phones in order", () => {
    const workers = seedWorkers(phones);
    expect(workers.map((w) => [w.name, w.trades, w.phone])).toEqual([
      ["Nishant", ["electrician"], "+919000000001"],
      ["Kalpana", ["plumber"], "+919000000002"],
      ["Sanskar", ["carpenter"], "+919000000003"],
    ]);
  });

  it("gives each worker every task of their trade and passes the dispatch rating cutoff", () => {
    for (const w of seedWorkers(phones)) {
      expect(w.skills).toEqual(skillsFor(w.trades[0]!));
      expect(w.rating).toBeGreaterThanOrEqual(3.8);
    }
  });
});

describe("seed stats", () => {
  it("is the same on every run", () => {
    expect(seedStats(1, ["tap_replace"])).toEqual(seedStats(1, ["tap_replace"]));
  });

  it("covers every skill in all four time bands, with accepts ≤ pick-ups ≤ offers", () => {
    const stats = seedStats(0, ["fan_install", "mcb_replace"]);
    expect(stats).toHaveLength(8);
    for (const s of stats) {
      expect(s.pickups).toBeLessThanOrEqual(s.offers);
      expect(s.accepts).toBeLessThanOrEqual(s.pickups);
      expect(s.offers).toBeGreaterThan(0);
    }
  });
});

describe("DEMO_WORKER_PHONES", () => {
  it("parses three comma-separated +91 numbers", () => {
    expect(DemoPhones.parse(phones.join(", "))).toEqual(phones);
  });

  it("rejects numbers without +91 or the wrong count", () => {
    expect(() => DemoPhones.parse("9000000001,9000000002,9000000003")).toThrow();
    expect(() => DemoPhones.parse(phones.slice(0, 2).join(","))).toThrow();
  });
});
