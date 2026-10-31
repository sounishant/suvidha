import { describe, expect, it } from "vitest";
import { rankQuotes, weightsFor, type QuoteForRanking, type RankRequest } from "../src/core/ranking.ts";

const at = (iso: string) => new Date(`${iso}+05:30`);
const quote = (q: Partial<QuoteForRanking> & { id: string }): QuoteForRanking => ({
  available: true, priceType: "fixed", price: null, earliestArrival: null, rating: 4.5,
  ratedJobs: 10, distanceKm: 1, quotedAt: at("2026-10-27T18:10"), materialIncluded: "yes", ...q,
});

// The worked example in the job card spec.
const w014 = quote({ id: "W-014", price: 350, earliestArrival: at("2026-10-27T17:30"), rating: 4.6, distanceKm: 1.2 });
const w022 = quote({ id: "W-022", price: 400, earliestArrival: at("2026-10-27T18:00"), rating: 4.2, distanceKm: 2.5 });
const w031 = quote({ id: "W-031", price: 300, earliestArrival: at("2026-10-28T10:00"), rating: 4.8, distanceKm: 3.1 });
const req = (r: Partial<RankRequest> = {}): RankRequest => ({
  priorities: ["speed", "price", "quality"], budgetInr: null, windowEnd: at("2026-10-28T12:00"), customerExpectsMaterial: false, ...r,
});
const round = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

describe("weights", () => {
  it("are 0.6 / 0.3 / 0.1 by priority order, or 0.6 / 0.2 / 0.2 when only the first is known", () => {
    expect(weightsFor(["speed", "price", "quality"])).toEqual({ speed: 0.6, price: 0.3, quality: 0.1 });
    expect(weightsFor(["price"])).toEqual({ price: 0.6, speed: 0.2, quality: 0.2 });
    expect(weightsFor(["quality", "speed"])).toEqual({ quality: 0.6, speed: 0.3, price: 0.1 });
  });
});

describe("rankQuotes", () => {
  it("reproduces the spec's worked example", () => {
    const ranked = rankQuotes([w022, w031, w014], req());
    expect(ranked.map((r) => [r.id, r.rank, round(r.score), r.lead])).toEqual([
      ["W-014", 1, 0.82, "speed"],
      ["W-022", 2, 0.58, "speed"],
      ["W-031", 3, 0.4, "price"],
    ]);
    expect(ranked[0]!.measures).toEqual({ speed: 1, price: 0.5, quality: expect.closeTo(0.67, 2) });
    expect(ranked[1]!.measures!.speed).toBeCloseTo(0.97, 2);
  });

  it("treats scores within 0.05 as tied and puts the closer worker first (price-first example)", () => {
    const ranked = rankQuotes([w014, w022, w031], req({ priorities: ["price", "speed", "quality"] }));
    expect(round(ranked.find((r) => r.id === "W-031")!.score)).toBe(0.7);
    expect(round(ranked.find((r) => r.id === "W-014")!.score)).toBe(0.67);
    expect(ranked.map((r) => r.id)).toEqual(["W-014", "W-031", "W-022"]);
  });

  it("breaks an exact tie on distance by whoever quoted first", () => {
    const a = quote({ id: "A", price: 300, earliestArrival: at("2026-10-27T17:00"), quotedAt: at("2026-10-27T18:12") });
    const b = { ...a, id: "B", quotedAt: at("2026-10-27T18:11") };
    expect(rankQuotes([a, b], req()).map((r) => r.id)).toEqual(["B", "A"]);
  });

  it("gives every measure 1 to a single quote", () => {
    expect(rankQuotes([w014], req())[0]).toMatchObject({ score: expect.closeTo(1, 9), measures: { speed: 1, price: 1, quality: 1 } });
  });

  it("gives workers with fewer than 3 rated jobs a quality of 0.5", () => {
    const fresh = quote({ id: "N", price: 300, earliestArrival: at("2026-10-27T17:30"), rating: 5, ratedJobs: 1 });
    expect(rankQuotes([w014, fresh], req()).find((r) => r.id === "N")!.measures!.quality).toBe(0.5);
  });

  it("drops a quote over budget by 0.2 and labels it, and labels material extra", () => {
    const ranked = rankQuotes([w014, w022, { ...w031, materialIncluded: "no" }], req({ budgetInr: 380, customerExpectsMaterial: true }));
    const w22 = ranked.find((r) => r.id === "W-022")!;
    expect(w22.labels).toEqual(["above_budget"]);
    expect(round(w22.score)).toBe(0.38);
    expect(ranked.find((r) => r.id === "W-031")!.labels).toEqual(["material_extra"]);
  });

  it("lists visit-only quotes below the ranked ones and late arrivals last; hides declines", () => {
    const visit = quote({ id: "V", priceType: "visit_only" });
    const late = quote({ id: "L", price: 200, earliestArrival: at("2026-10-29T09:00") });
    const declined = quote({ id: "D", available: false, priceType: null });
    const ranked = rankQuotes([late, visit, declined, w014], req());
    expect(ranked.map((r) => [r.id, r.group, r.rank])).toEqual([["W-014", "ranked", 1], ["V", "visit", 2], ["L", "later", 3]]);
    expect(ranked[2]!.labels).toContain("after_window");
  });
});
