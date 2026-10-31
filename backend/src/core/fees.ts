// The customer's booking fee grows with the job, close to the 4–5% food apps charge.
export function bookingFee(priceInr: number) {
  return priceInr < 500 ? 29 : priceInr < 2000 ? 49 : 99;
}

export const TRAVEL_PAY_INR = 25;
export const APOLOGY_CREDIT_INR = 25;
// A booked worker who hasn't set out this long after their arrival time counts as a no-show.
export const NO_SHOW_GRACE_MIN = 30;
export const NO_SHOW_CALL_LAST_DAYS = 2;

export type CancelCause = "customer_before_trip" | "customer_after_trip" | "no_show" | "worker" | "suvidha";

// Money returns the way it came (cash, then credit); whoever caused the cancellation bears its cost.
export function cancellationSplit(paid: { feeInr: number; amountInr: number }, cause: CancelCause) {
  const travelPay = cause === "customer_after_trip" ? Math.min(TRAVEL_PAY_INR, paid.feeInr) : 0;
  const returnable = paid.feeInr - travelPay;
  const cashBack = Math.min(paid.amountInr, returnable);
  const apology = cause === "no_show" || cause === "worker" || cause === "suvidha" ? APOLOGY_CREDIT_INR : 0;
  return { cashBack, creditBack: returnable - cashBack, apology, travelPay };
}
