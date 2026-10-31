// The customer's booking fee grows with the job, close to the 4–5% food apps charge.
export function bookingFee(priceInr: number) {
  return priceInr < 500 ? 29 : priceInr < 2000 ? 49 : 99;
}
