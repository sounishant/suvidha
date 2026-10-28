import { describe, expect, it } from "vitest";
import { toE164, toWhatsApp } from "../src/core/phone.ts";
import { cleanRef, newRef, withFreshRef } from "../src/core/refs.ts";
import { inCustomerCallingHours, istClock, istDayStart } from "../src/core/time.ts";
import { copyFor, priceLabel, say, whatsappText, whenLabel } from "../src/messages.ts";

describe("refs", () => {
  it("are 4 characters without look-alikes", () => {
    for (let i = 0; i < 200; i++) expect(newRef()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });

  it("tolerate spaces, dashes and lower case from the agent", () => {
    expect(cleanRef(" c7-q 4 ")).toBe("C7Q4");
  });

  it("retry a clash with a fresh code but surface other errors", async () => {
    let calls = 0;
    const ref = await withFreshRef(async (r) => {
      if (++calls < 3) throw Object.assign(new Error("dup"), { code: "23505" });
      return r;
    });
    expect([calls, ref.length]).toEqual([3, 4]);
    await expect(withFreshRef(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });
});

describe("phones", () => {
  it("normalises every format we receive to E.164", () => {
    expect(["+919876543210", "919876543210", "9876543210", "+91 98765-43210"].map(toE164)).toEqual(Array(4).fill("+919876543210"));
    expect(toWhatsApp("+919876543210")).toBe("919876543210");
  });
});

describe("India time", () => {
  it("starts the day at IST midnight and speaks a 12-hour clock", () => {
    const at = new Date("2026-10-27T13:10:00Z"); // 18:40 IST
    expect(istDayStart(at).toISOString()).toBe("2026-10-26T18:30:00.000Z");
    expect(istClock(at)).toBe("6:40");
  });

  it("calls customers only from 8 am to 9 pm IST", () => {
    expect(inCustomerCallingHours(new Date("2026-10-27T02:29:00Z"))).toBe(false); // 7:59
    expect(inCustomerCallingHours(new Date("2026-10-27T02:30:00Z"))).toBe(true); // 8:00
    expect(inCustomerCallingHours(new Date("2026-10-27T15:30:00Z"))).toBe(false); // 21:00
  });
});

describe("messages", () => {
  const keys = (lang: string) =>
    Object.entries(copyFor(lang)).flatMap(([section, entries]) => Object.keys(entries).map((k) => `${section}.${k}`)).sort();

  it("has the same keys in Hindi and English", () => {
    expect(keys("en")).toEqual(keys("hi"));
  });

  it("falls back to Hindi for languages without copy", () => {
    expect(say("ta", "error")).toBe(say("hi", "error"));
  });

  it("writes prices and times the way the shortlist shows them", () => {
    expect([priceLabel("hi", 350, 350), priceLabel("en", 300, 400)]).toEqual(["₹350", "₹300–400"]);
    const now = new Date("2026-10-27T10:00:00Z");
    expect(whenLabel("hi", new Date("2026-10-27T12:00:00Z"), now)).toBe("aaj 5:30 pm");
    expect(whenLabel("en", new Date("2026-10-28T04:30:00Z"), now)).toBe("tomorrow 10 am");
    expect(whenLabel("en", new Date("2026-10-30T10:30:00Z"), now)).toBe("30 Oct 4 pm");
  });

  it("keeps the list button and section titles within WhatsApp limits", () => {
    for (const lang of ["hi", "en"]) {
      expect(whatsappText(lang, "list_button").length).toBeLessThanOrEqual(20);
      for (const s of ["section_ranked", "section_visit", "section_later"]) expect(whatsappText(lang, s).length).toBeLessThanOrEqual(24);
    }
  });
});
