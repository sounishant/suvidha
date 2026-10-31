import { describe, expect, it } from "vitest";
import { bookingFee, cancellationSplit } from "../src/core/fees.ts";

describe("bookingFee", () => {
  it("is ₹29 under ₹500, ₹49 up to ₹1,999 and ₹99 from ₹2,000", () => {
    expect([0, 499, 500, 1999, 2000, 15000].map(bookingFee)).toEqual([29, 29, 49, 49, 99, 99]);
  });
});

describe("cancellationSplit", () => {
  const paid = { feeInr: 49, amountInr: 49 };

  it("refunds everything when the customer cancels before the worker sets out", () => {
    expect(cancellationSplit(paid, "customer_before_trip")).toEqual({ cashBack: 49, creditBack: 0, apology: 0, travelPay: 0 });
  });

  it("pays the worker ₹25 for travel once they have set out", () => {
    expect(cancellationSplit(paid, "customer_after_trip")).toEqual({ cashBack: 24, creditBack: 0, apology: 0, travelPay: 25 });
  });

  it("refunds in full and adds ₹25 credit when the worker or Suvidha is at fault", () => {
    for (const cause of ["worker", "suvidha", "no_show"] as const) {
      expect(cancellationSplit(paid, cause)).toEqual({ cashBack: 49, creditBack: 0, apology: 25, travelPay: 0 });
    }
  });

  it("returns money the way it came: cash first, the rest as credit", () => {
    expect(cancellationSplit({ feeInr: 29, amountInr: 4 }, "customer_before_trip")).toEqual({ cashBack: 4, creditBack: 25, apology: 0, travelPay: 0 });
    expect(cancellationSplit({ feeInr: 29, amountInr: 4 }, "customer_after_trip")).toEqual({ cashBack: 4, creditBack: 0, apology: 0, travelPay: 25 });
  });
});
