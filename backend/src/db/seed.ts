import postgres, { type Sql } from "postgres";
import { z } from "zod";
import { readEnv } from "../config.ts";

export type Trade = "plumber" | "electrician" | "carpenter";
type RateCardRow = { trade: Trade; job_type: string; label: string; price_inr: number; price_kind: "fixed" | "visit" };

// Placeholder Roorkee prices (labour only, materials extra); see docs/spec.md §3.
export const RATE_CARD: RateCardRow[] = [
  { trade: "plumber", job_type: "tap_replace", label: "Tap replacement", price_inr: 200, price_kind: "fixed" },
  { trade: "plumber", job_type: "washbasin_install", label: "Washbasin installation", price_inr: 450, price_kind: "fixed" },
  { trade: "plumber", job_type: "flush_tank_repair", label: "Flush tank repair", price_inr: 300, price_kind: "fixed" },
  { trade: "plumber", job_type: "pipe_leak_repair", label: "Small pipe leak repair", price_inr: 350, price_kind: "fixed" },
  { trade: "plumber", job_type: "drain_unblock", label: "Drain / sink unblocking", price_inr: 400, price_kind: "fixed" },
  { trade: "plumber", job_type: "unclear", label: "Visit charge", price_inr: 150, price_kind: "visit" },
  { trade: "electrician", job_type: "fan_install", label: "Ceiling fan installation", price_inr: 250, price_kind: "fixed" },
  { trade: "electrician", job_type: "switchboard_repair", label: "Switchboard repair", price_inr: 200, price_kind: "fixed" },
  { trade: "electrician", job_type: "light_fitting", label: "Light / tube fitting", price_inr: 150, price_kind: "fixed" },
  { trade: "electrician", job_type: "socket_install", label: "New socket / point", price_inr: 180, price_kind: "fixed" },
  { trade: "electrician", job_type: "mcb_replace", label: "MCB replacement", price_inr: 300, price_kind: "fixed" },
  { trade: "electrician", job_type: "unclear", label: "Visit charge", price_inr: 150, price_kind: "visit" },
  { trade: "carpenter", job_type: "door_repair", label: "Door repair / alignment", price_inr: 250, price_kind: "fixed" },
  { trade: "carpenter", job_type: "lock_install", label: "Lock / latch fitting", price_inr: 200, price_kind: "fixed" },
  { trade: "carpenter", job_type: "hinge_handle_replace", label: "Hinge / handle replacement", price_inr: 150, price_kind: "fixed" },
  { trade: "carpenter", job_type: "furniture_repair", label: "Furniture repair", price_inr: 350, price_kind: "fixed" },
  { trade: "carpenter", job_type: "shelf_install", label: "Shelf / curtain rod fitting", price_inr: 200, price_kind: "fixed" },
  { trade: "carpenter", job_type: "unclear", label: "Visit charge", price_inr: 150, price_kind: "visit" },
];

export function skillsFor(trade: Trade) {
  return RATE_CARD.filter((r) => r.trade === trade && r.price_kind === "fixed").map((r) => r.job_type);
}

// Coordinates are approximate points in Civil Lines, Roorkee (the demo locality).
const DEMO_WORKERS = [
  { name: "Nishant", trade: "electrician", lat: 29.8697, lng: 77.8862, rating: 4.6, rating_count: 31 },
  { name: "Kalpana", trade: "plumber", lat: 29.8668, lng: 77.8901, rating: 4.8, rating_count: 42 },
  { name: "Sanskar", trade: "carpenter", lat: 29.864, lng: 77.8875, rating: 4.5, rating_count: 18 },
] as const;

export const TIME_BANDS = ["morning", "afternoon", "evening", "night"] as const;
const BAND_OFFERS = { morning: 8, afternoon: 10, evening: 7, night: 2 };

export function seedWorkers(phones: string[]) {
  return DEMO_WORKERS.map((w, i) => ({
    ...w,
    phone: phones[i]!,
    skills: skillsFor(w.trade),
    locality: "Civil Lines",
    hours_start: "08:00",
    hours_end: "20:00",
    language: "hi",
    has_smartphone: true,
    online: true,
    checks: { id: true, skills: true },
    verified: true,
  }));
}

// Deterministic generator so every seed run produces the same "history".
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function seedStats(workerIndex: number, skills: string[]) {
  const rand = mulberry32(workerIndex + 1);
  return skills.flatMap((job_type) =>
    TIME_BANDS.map((time_band) => {
      const offers = round1(BAND_OFFERS[time_band] * (0.6 + 0.8 * rand()));
      const pickups = round1(offers * (0.6 + 0.35 * rand()));
      const accepts = round1(pickups * (0.5 + 0.4 * rand()));
      return { job_type, time_band, offers, pickups, accepts };
    }),
  );
}

export async function seed(sql: Sql, phones: string[]) {
  const workers = seedWorkers(phones);
  const now = new Date();
  const workerRows = workers.map(({ checks, ...w }) => ({
    ...w,
    checks: sql.json(checks),
    online_at: now,
    ai_call_consent_at: now,
  }));

  // One statement per table: each query is a round trip to Supabase.
  await sql.begin(async (tx) => {
    await tx`
      insert into rate_card ${tx(RATE_CARD)}
      on conflict (trade, job_type) do update
        set label = excluded.label, price_inr = excluded.price_inr, price_kind = excluded.price_kind`;

    const ids = await tx<{ id: string; phone: string }[]>`
      insert into workers ${tx(workerRows)}
      on conflict (phone) do update
        set name = excluded.name, trade = excluded.trade, skills = excluded.skills, locality = excluded.locality,
            lat = excluded.lat, lng = excluded.lng, hours_start = excluded.hours_start, hours_end = excluded.hours_end,
            language = excluded.language, has_smartphone = excluded.has_smartphone, online = excluded.online,
            online_at = excluded.online_at, checks = excluded.checks, verified = excluded.verified,
            rating = excluded.rating, rating_count = excluded.rating_count
      returning id, phone`;
    const idByPhone = new Map(ids.map((r) => [r.phone, r.id]));

    const statRows = workers.flatMap((w, i) =>
      seedStats(i, w.skills).map((s) => ({ worker_id: idByPhone.get(w.phone)!, ...s, updated_at: now })),
    );
    await tx`
      insert into worker_stats ${tx(statRows)}
      on conflict (worker_id, job_type, time_band) do update
        set offers = excluded.offers, pickups = excluded.pickups, accepts = excluded.accepts, updated_at = excluded.updated_at`;
  });
  return workers;
}

export const DemoPhones = z
  .string()
  .transform((s) => s.split(",").map((p) => p.trim()))
  .pipe(z.array(z.string().regex(/^\+91[6-9]\d{9}$/, "phone must be +91 followed by 10 digits")).length(3));

if (import.meta.main) {
  const env = readEnv(z.object({ DATABASE_URL: z.string().min(1), DEMO_WORKER_PHONES: DemoPhones }), process.env);
  const sql = postgres(env.DATABASE_URL);
  const workers = await seed(sql, env.DEMO_WORKER_PHONES);
  console.log(`seeded ${RATE_CARD.length} rate-card rows and ${workers.length} workers: ${workers.map((w) => `${w.name} (${w.trade})`).join(", ")}`);
  await sql.end();
}
