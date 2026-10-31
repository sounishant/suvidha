export type PaymentGateway = {
  provider: string;
  createLink(payment: { id: string; amountInr: number }): Promise<string>;
  refund(payment: { id: string; amountInr: number }): Promise<void>;
  payout(to: { workerPhone: string; amountInr: number; jobRef: string }): Promise<void>;
};

// Until a real provider is chosen: the link opens our own test page, and refunds and payouts are only logged.
export function fakePayments(publicUrl: string, log: (line: string) => void): PaymentGateway {
  return {
    provider: "fake",
    createLink: async ({ id }) => `${publicUrl}/pay/${id}`,
    refund: async ({ id, amountInr }) => log(`[fake payments] refund ₹${amountInr} for payment ${id}`),
    payout: async ({ amountInr, jobRef }) => log(`[fake payments] payout ₹${amountInr} to the worker on job ${jobRef}`),
  };
}
