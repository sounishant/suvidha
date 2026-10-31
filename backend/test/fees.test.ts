import { describe, expect, it } from "vitest";
import { bookingFee } from "../src/core/fees.ts";

describe("bookingFee", () => {
  it("is ₹29 under ₹500, ₹49 up to ₹1,999 and ₹99 from ₹2,000", () => {
    expect([0, 499, 500, 1999, 2000, 15000].map(bookingFee)).toEqual([29, 29, 49, 49, 99, 99]);
  });
});
