import { describe, expect, it } from "vitest";
import { customerCard, flattenExtraction, inferUrgency, missingFields, toBudget, toMaterial, toPriorities, toTimestamp, workerQuote } from "../src/core/card.ts";

const NOW = new Date("2026-10-27T10:00:00Z"); // 15:30 IST

describe("flattenExtraction", () => {
  it("finds fields under Bolna's categories, unwraps {subjective} and drops empty answers", () => {
    const f = flattenExtraction({
      General: { "Call Summary": { subjective: "Tap leaking" } },
      "Job Card": { Trade: "Plumber", "Job Type": { value: "tap_repair" }, Budget: "N/A", "Site Contact": "" },
    });
    expect(Object.fromEntries(f)).toEqual({ call_summary: "Tap leaking", trade: "Plumber", job_type: "tap_repair" });
  });

  it("reads Bolna's result objects: the chosen option first, free text when no option was chosen", () => {
    const f = flattenExtraction({
      "Job Card": {
        trade: { subjective: "carpenter hai", objective: "carpenter", confidence: 0.9, reasoning_objective: "said darwaza" },
        problem: { subjective: "Door hinge broken", objective: null, confidence: 0.8 },
        budget: { subjective: "", objective: "N/A" },
      },
    });
    expect(Object.fromEntries(f)).toEqual({ trade: "carpenter", problem: "Door hinge broken" });
  });
});

describe("customerCard", () => {
  const extraction = {
    job_card: {
      trade: "carpenter", job_type: "door repair", problem: "Room door won't close; one hinge broken",
      material: "worker brings", first_name: "Rohan",
      address: "Room 204, Sunrise Hostel, 5th Block, Koramangala, near Forum mall",
      time_window_earliest: "2026-10-27T16:00", time_window_latest: "2026-10-28T12:00", time_window: "aaj shaam tak",
      priority_first: "speed", budget: "", safety_note: "Name to be entered at the hostel gate",
      complexity: "standard", language: "hinglish",
    },
  };

  it("builds the spec's sample card", () => {
    const card = customerCard(extraction, NOW);
    expect(card).toMatchObject({
      trade: "carpenter", jobType: "door_repair", jobTypeOther: null, material: "worker_brings", firstName: "Rohan",
      priorities: ["speed"], budgetInr: null, complexity: "standard", language: "hi",
      windowEnd: new Date("2026-10-28T06:30:00Z"),
    });
    expect(missingFields(card)).toEqual([]);
  });

  it("keeps the caller's words for a job type outside the list", () => {
    const card = customerCard({ trade: "carpenter", job_type: "Jhoola theek karna" }, NOW);
    expect([card.jobType, card.jobTypeOther]).toEqual(["other", "Jhoola theek karna"]);
  });

  it("lists every required field that came back empty", () => {
    expect(missingFields(customerCard({ trade: "plumber", problem: "leak" }, NOW))).toEqual(["job_type", "material", "address", "time_window", "priority"]);
  });
});

describe("normalisers", () => {
  it("read material, priorities and budgets the way callers say them", () => {
    expect(["Carpenter laaye", "mere paas hai", "pata nahi", "worker_brings"].map(toMaterial)).toEqual(["worker_brings", "customer_has", "not_sure", "worker_brings"]);
    expect(toPriorities("woh bahut late aaya tha")).toEqual(["speed"]);
    expect(toPriorities("price, speed, quality")).toEqual(["price", "speed", "quality"]);
    expect([toBudget("Rs 300 to 500"), toBudget("1,200"), toBudget("koi nahi")]).toEqual([500, 1200, null]);
  });

  it("reads times without a zone as India time", () => {
    expect(toTimestamp("2026-10-27 17:30")!.toISOString()).toBe("2026-10-27T12:00:00.000Z");
    expect(toTimestamp("2026-10-27T17:30:00Z")!.toISOString()).toBe("2026-10-27T17:30:00.000Z");
    expect(toTimestamp("aaj shaam")).toBeNull();
  });

  it("works out urgency from the end of the time window", () => {
    const now = new Date("2026-10-27T10:00:00Z"); // 15:30 IST
    expect(inferUrgency(new Date("2026-10-27T15:00:00Z"), now)).toBe("today");
    expect(inferUrgency(new Date("2026-10-28T06:30:00Z"), now)).toBe("tomorrow");
    expect(inferUrgency(new Date("2026-10-31T06:30:00Z"), now)).toBe("this_week");
    expect(inferUrgency(null, now)).toBe("flexible");
  });
});

describe("workerQuote", () => {
  it("reads a range quote", () => {
    expect(workerQuote({ quote: { available: "yes", price_min: "300", price_max: "400", material_included: "yes", earliest_arrival: "2026-10-27T17:30", duration: "45 minutes" } }, NOW)).toMatchObject({
      available: true, priceType: "range", priceMin: 300, priceMax: 400, materialIncluded: "yes", durationMins: 45,
      earliestArrival: new Date("2026-10-27T12:00:00Z"),
    });
  });

  it("reads a fixed price, a visit-only quote and a decline", () => {
    expect(workerQuote({ available: "haan", price: "350" }, NOW)).toMatchObject({ priceType: "fixed", priceMin: 350, priceMax: 350 });
    expect(workerQuote({ available: "yes", price_type: "only after visit", visit_charge: "100" }, NOW)).toMatchObject({ priceType: "visit_only", priceMin: null, visitCharge: 100 });
    expect(workerQuote({ available: "no", decline_reason: "bahut door hai" }, NOW)).toMatchObject({ available: false, declineReason: "too_far", priceType: null });
  });

  it("keeps an estimated range even when he says the final price comes after seeing the job", () => {
    // Kalpana: "kaam dekh kar bata payenge, waise 300-400 rupaye mein ho jana chahiye"
    expect(workerQuote({ available: "yes", price_type: "visit_only", price_min: "300", price_max: "400" }, NOW))
      .toMatchObject({ priceType: "range", priceMin: 300, priceMax: 400 });
  });
});

describe("dates the extraction can get right", () => {
  it("works out the customer's window from a day and a time, on the call's calendar", () => {
    expect(customerCard({ time_window_day: "tomorrow", time_window_time: "6 pm" }, NOW).windowEnd).toEqual(new Date("2026-10-28T12:30:00Z"));
    expect(customerCard({ time_window_day: "today" }, NOW).windowEnd).toEqual(new Date("2026-10-27T18:29:00Z"));
    expect(customerCard({ time_window_day: "flexible" }, NOW).windowEnd).toBeNull();
  });

  it("ignores a timestamp that is not near the call", () => {
    expect(customerCard({ time_window_latest: "2024-01-05T18:00", time_window_day: "today", time_window_time: "18:00" }, NOW).windowEnd)
      .toEqual(new Date("2026-10-27T12:30:00Z"));
  });

  it("works out a worker's arrival from minutes, or a day and time", () => {
    expect(workerQuote({ available: "yes", price: "300", arrival_in_minutes: "20" }, NOW).earliestArrival).toEqual(new Date("2026-10-27T10:20:00Z"));
    expect(workerQuote({ available: "yes", price: "300", arrival_day: "tomorrow", arrival_time: "10:00" }, NOW).earliestArrival).toEqual(new Date("2026-10-28T04:30:00Z"));
    expect(workerQuote({ available: "yes", price: "300", arrival_day: "today" }, NOW).earliestArrival).toEqual(new Date("2026-10-27T11:00:00Z"));
  });

  it("reads a clock time as its next occurrence, whatever day the extraction guessed", () => {
    const twoAm = new Date("2026-10-30T20:48:00Z"); // 2:18 am IST, as in Kalpana's call
    expect(workerQuote({ available: "yes", price: "300", arrival_day: "later", arrival_time: "08:00" }, twoAm).earliestArrival)
      .toEqual(new Date("2026-10-31T02:30:00Z"));
    const ninePm = new Date("2026-10-30T15:30:00Z"); // 9 pm IST: "8 baje" means tomorrow morning
    expect(workerQuote({ available: "yes", price: "300", arrival_time: "08:00" }, ninePm).earliestArrival)
      .toEqual(new Date("2026-10-31T02:30:00Z"));
  });
});
