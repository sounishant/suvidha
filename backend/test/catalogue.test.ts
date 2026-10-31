import { describe, expect, it } from "vitest";
import { JOB_TYPES, toJobType, toTrade, TRADES } from "../src/core/catalogue.ts";
import { copyFor } from "../src/messages.ts";

describe("trades and job types", () => {
  it("are the job card spec's three trades plus other, each with an other job type", () => {
    expect(TRADES).toEqual(["carpenter", "plumber", "electrician", "other"]);
    for (const t of TRADES) expect(JOB_TYPES[t]).toContain("other");
  });

  it("map what the agent sends to a code, unknown words to other", () => {
    expect([toTrade(" Plumber "), toTrade("tailor")]).toEqual(["plumber", "other"]);
    expect([toJobType("carpenter", "Door repair"), toJobType("carpenter", "jhoola")]).toEqual(["door_repair", "other"]);
  });

  it("has a WhatsApp label for every job type in Hindi and English", () => {
    const codes = [...new Set(Object.values(JOB_TYPES).flat())];
    for (const lang of ["hi", "en"]) expect(codes.filter((c) => !copyFor(lang).job_type[c])).toEqual([]);
  });
});
