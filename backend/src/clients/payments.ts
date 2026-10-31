export type PaymentGateway = {
  provider: string;
  createLink(payment: { id: string; amountInr: number }): Promise<string>;
};

// Until a real provider is chosen: the link opens our own test page, which marks the payment paid.
export function fakePayments(publicUrl: string): PaymentGateway {
  return {
    provider: "fake",
    createLink: async ({ id }) => `${publicUrl}/pay/${id}`,
  };
}
