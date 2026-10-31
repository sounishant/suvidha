import type { JobStatus, Quote } from "./api";

type StatusText = { label: string; line: string; open: boolean };

export const STATUS: Record<JobStatus, StatusText> = {
  draft: { label: "Jaankari baaki", line: "WhatsApp pe pucha gaya sawaal ka jawab dijiye, phir hum kaarigar dhoondhenge.", open: true },
  confirmed: { label: "Card taiyaar", line: "Aapka kaam ka card ban gaya. Ek minute mein kaarigaron ko call shuru hogi.", open: true },
  inviting: { label: "Kaarigar dhoondh rahe hain", line: "Paas ke kaarigaron se daam le rahe hain. Teen daam aate hi aapko batayenge.", open: true },
  quotes_in: { label: "Daam aa gaye", line: "Neeche daam dekhiye aur jo kaarigar theek lage, use chuniye.", open: true },
  booked: { label: "Kaarigar booked", line: "Kaarigar aa raha hai. Pahunchne pe use start code bataiye.", open: true },
  done: { label: "Kaam ho gaya", line: "Ye kaam poora ho chuka hai.", open: false },
  cancelled: { label: "Cancel hua", line: "Ye kaam cancel ho gaya.", open: false },
  no_workers: { label: "Kaarigar nahi mile", line: "Maaf kijiye, abhi aapke ilaake mein koi kaarigar uplabdh nahi tha.", open: false },
};

// The steps a customer sees; draft and confirmed both count as the first step.
export const STEPS = ["Card bana", "Daam aa rahe", "Kaarigar chuna", "Kaam ho gaya"] as const;
export function stepOf(status: JobStatus) {
  if (status === "draft" || status === "confirmed") return 0;
  if (status === "inviting" || status === "quotes_in") return 1;
  if (status === "booked") return 2;
  return 3;
}

export const TRADE: Record<string, string> = {
  plumber: "Plumber",
  electrician: "Electrician",
  carpenter: "Carpenter",
  other: "Kaarigar",
};

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function quotePrice(q: Pick<Quote, "priceType" | "price" | "visitCharge">) {
  if (q.priceType === "visit_only") return q.visitCharge ? `Dekh ke batayenge · visit ${rupees(q.visitCharge)}` : "Dekh ke batayenge";
  return q.price !== null ? rupees(q.price) : "—";
}

export const MATERIAL: Record<string, string> = {
  customer_has: "Saaman aapke paas hai",
  worker_brings: "Kaarigar saaman laayega",
  not_sure: "Saaman pakka nahi",
  yes: "Saaman shaamil",
  no: "Saaman alag se",
  partly: "Kuch saaman shaamil",
};

export { rupees };
