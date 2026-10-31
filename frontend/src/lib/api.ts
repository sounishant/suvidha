import "server-only";

// Shapes the backend's /app routes return (backend/src/core/customer-app.ts).
export type JobStatus = "draft" | "confirmed" | "inviting" | "quotes_in" | "booked" | "done" | "cancelled" | "no_workers";

export type JobSummary = {
  ref: string;
  status: JobStatus;
  trade: string;
  title: string;
  locality: string | null;
  when: string;
  createdAt: string;
  worker: string | null;
  eta: string | null;
  price: number | null;
};

export type Quote = {
  ref: string;
  worker: string;
  rating: number | null;
  verified: boolean;
  priceType: "fixed" | "visit_only" | null;
  price: number | null;
  visitCharge: number | null;
  materialIncluded: "yes" | "no" | "partly" | null;
  arrives: string | null;
  distanceKm: number | null;
  group: "ranked" | "visit" | "later" | null;
  reason: string | null;
  note: string | null;
};

export type Booking = {
  worker: string;
  rating: number | null;
  verified: boolean;
  eta: string | null;
  stage: "booked" | "on_the_way" | "working" | "done" | "closed";
  startCode: string | null;
  finishCode: string | null;
  fixed: boolean | null;
  finalPrice: number | null;
};

export type JobDetail = JobSummary & {
  problem: string | null;
  address: string | null;
  material: string | null;
  safetyNote: string | null;
  budget: number | null;
  quotes: Quote[];
  booking: Booking | null;
};

type Init = { token?: string; method?: "GET" | "POST"; body?: object };

// Every call goes through the Next.js server; the browser never sees the app token or talks to the backend.
export async function backend<T>(path: string, { token, method = "GET", body }: Init = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(`${process.env.BACKEND_URL}/app${path}`, {
    method,
    headers: {
      "x-app-token": process.env.APP_API_TOKEN!,
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  return { status: res.status, data: (await res.json()) as T };
}

// Shapes of /worker/home (backend/src/core/worker-app.ts).
export type PriceType = "fixed" | "visit_only";

export type Invite = {
  quoteRef: string;
  jobRef: string;
  trade: string;
  title: string;
  problem: string | null;
  locality: string | null;
  material: string | null;
  safetyNote: string | null;
  when: string;
  distanceKm: number | null;
  state: "open" | "sent" | "closed";
  myQuote: { available: boolean | null; priceType: PriceType | null; price: number | null; visitCharge: number | null; arrives: string | null } | null;
};

export type ActiveJob = {
  jobRef: string;
  trade: string;
  title: string;
  problem: string | null;
  address: string | null;
  customer: string | null;
  safetyNote: string | null;
  when: string;
  eta: string | null;
  stage: "booked" | "on_the_way" | "working" | "done";
  price: number | null;
};

export type WorkerHome = {
  profile: { name: string; trades: string[]; verified: boolean; rating: number | null; online: boolean };
  invites: Invite[];
  active: ActiveJob[];
  earnings: { jobs: number; total: number; monthJobs: number; monthTotal: number };
  recent: { jobRef: string; trade: string; title: string; locality: string | null; closedAt: string; price: number | null }[];
};
