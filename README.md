# Suvidha

**Call once. We find the worker. A voice-first marketplace for household repairs in Tier 2 India.**

**[How it works](#how-it-works) · [The live demo](#the-live-demo) · [Run it locally](#run-it-locally) · [Architecture](#architecture) · [Status](#status)**

## The problem

In a Tier 2 town, getting a tap fixed means asking a neighbour for a number, calling it, and hoping the plumber picks up, is free today, and charges something reasonable. Repair apps assume a smartphone, English and patience with forms. Most households have the first, many lack the second, and nobody has the third when water is on the floor.

The other side is just as broken. Local plumbers, electricians and carpenters get work by word of mouth, ignore calls from unknown numbers, and have no way to show a stranger that they are good and nearby. Suvidha puts a phone call in the middle: the customer describes the problem in their own words, and an AI agent turns it into a job, finds workers, collects their rates and lets the customer pick one on WhatsApp. Nobody installs anything.

## How it works

```
 Customer ──call──▶ Customer Agent (Bolna, Hindi / Hinglish)
                        │  story first, then only the missing questions, then a read-back
                        ▼
                  Job card  ◀── extraction after hang-up: trade, job, problem, material,
                        │        address, time window, priority, budget, safety note
                        ├──▶ WhatsApp: summary + "send a photo" + one question per missing field
                        ▼
                  Worker calls  (same trade, right skill first, then nearest; 2 at a time)
                        │  Worker Agent calls each worker while the job card + photo
                        │  reach them on WhatsApp; each call ends in a quote
                        ▼
                  Ranking  (speed · price · quality, weighted by the customer's priority)
                        ▼
 Customer ◀──WhatsApp── Shortlist with a reason per worker ──tap──▶ Booked
                        │
                        ├──▶ Customer: worker, arrival time, rate, start code
                        └──▶ Worker: address, site contact, safety note
```

1. **One call builds the job card.** The Customer Agent opens with "Main Suvidha AI hoon. Batayiye, kya problem hai?", lets the caller tell the story, asks only what is missing from a short per-trade question set, reads the job back and hangs up. When the call ends, Bolna's extraction fills a structured job card from the confirmed read-back. Anything still missing is asked on WhatsApp, one question at a time, never by calling back.
2. **Workers are called, not broadcast to.** A minute after the card is complete (or as soon as the photo arrives), the Worker Agent calls workers of that trade, two at a time, right skill first and then nearest. Each worker gets the job card and photo on WhatsApp at the same moment, but never the exact address, the customer's number or the budget. Calling stops at 3 quotes or 6 calls, whichever comes first.
3. **The customer chooses, with reasons.** Quotes are scored on speed, price and rating, weighted by what the customer said hurt most last time ("late", "overcharged", "bad work"). The shortlist arrives as a WhatsApp list, each worker with a one-line reason such as "Earliest arrival: today 5:30 pm". One tap books. The customer gets the worker's name, arrival time, rate and a start code; the worker gets the address; everyone else is told politely.

**Measured:** four jobs booked end to end on real phones (Oct 30–31, 2026). Intake calls took 0.8 to 1.5 minutes; the median across 17 completed calls, customers and workers, was 91 seconds. From the customer hanging up to a booked worker took **2 min 41 s to 3 min 28 s**, most of it the worker's own call. The caller lookup that runs before each call answers in 0.5 to 0.8 s through the tunnel.

## The live demo

1. A customer calls the Suvidha number and says, in Hinglish, "Kitchen ka nal leak ho raha hai, aaj shaam tak chahiye."
2. Within seconds of hanging up, WhatsApp shows "*Your Suvidha request*" with the job, material, address and deadline, and asks for a photo.
3. The plumber's phone rings. The agent describes the job, takes a rate and an arrival time, and reads the quote back. The job card and the customer's photo are already on the plumber's WhatsApp.
4. The customer taps **Choose worker** on the shortlist. Both sides get the booking; the customer holds the start code, the worker gets the address.

Everything the agents say lives in the Bolna agent setup; every WhatsApp line lives in `backend/messages/en.json` and `backend/messages/hi.json`. The backend keeps every incoming Bolna and WhatsApp request raw in `webhook_log`, so any demo run can be traced afterwards, call by call.

Languages: Hindi and Hinglish on calls; WhatsApp in Hinglish (Roman script) or English.

### Try it yourself

The web app runs alongside the phone flow. Customers sign in with a code sent on WhatsApp at `/login` to see their bookings and request a worker; workers sign in at `/login/worker` to see jobs, send a quote, step through a booking with the start and finish codes, and see their earnings.

While testing, set `CUSTOMER_LINE_MODE=test` so the team's own phones can call as often as they like. Workers calling the customer line are then treated as customers too. Switch it back to `live` for the demo.

## Run it locally

You need Node 24, a Supabase project, a Bolna account with two agents, a Meta WhatsApp test number and `cloudflared`.

```bash
git clone https://github.com/sounishant/suvidha.git && cd suvidha
cp .env.example .env                        # fill in every key

cd backend
npm install
npm run migrate && npm run seed             # schema, task catalogue, workers from DEMO_WORKER_PHONES
npm run create-photo-bucket                 # private Supabase Storage bucket for job photos
npm run dev                                 # http://localhost:8080

cloudflared tunnel --url http://localhost:8080    # public URL for Bolna and Meta

cd ../frontend
npm install
npm run dev                                 # http://localhost:3000
```

| URL | What |
|---|---|
| `/health` | Backend and database check |
| `/bolna/lookup/customer`, `/bolna/lookup/worker` | Caller lookup Bolna runs before answering; returns a short caller code instead of a phone number |
| `/bolna/webhook/call` | Every call status; the job card and worker quotes arrive here in the extraction when a call ends |
| `/bolna/fn/register_worker` | Worker Agent function for new workers who call in |
| `/whatsapp/webhook` | Button taps, photos, replies and delivery receipts from Meta |
| `/app/*` | Web app API, called only by the Next.js server |
| `localhost:3000/login`, `/login/worker` | Customer and worker web app |

Point both Bolna agents' call webhook and the Customer Agent's inbound lookup at the tunnel URL, and Meta's WhatsApp webhook at `<tunnel>/whatsapp/webhook`. The Customer Agent needs the "Job Card" extraction fields and the Worker Agent the "Quote" fields; the names the backend reads are in `backend/src/core/card.ts`. The web app reads `BACKEND_URL` and `APP_API_TOKEN` from `frontend/.env.local`.

Tests: `npm run typecheck`, `npm test` (84 unit tests) and `npm run test:db` (38 database tests, including a full call-to-booking flow, in their own schema). `npm run sim` replays signed Bolna and WhatsApp requests against a running server.

## Architecture

The backend is TypeScript on Node 24 with Express, plain SQL through postgres.js, and Zod at every boundary. It has three entry points (Bolna, WhatsApp, the web app), and all of them call the same functions in `backend/src/core/`.

- **Every request is checked, then saved, then deduplicated.** Bolna requests carry a bearer token or a shared header, Meta's are HMAC-signed. Each one is stored raw in `webhook_log` before anything acts on it, and repeats (a WhatsApp message ID, a Bolna call ID plus status) are answered and ignored.
- **Timers live in the database.** Every wait (invite workers in a minute, give up on an unanswered call) is a `next_action_at` column. A loop every few seconds acts on whatever is overdue, so a restart loses nothing.
- **The AI never handles phone numbers.** The lookup hands the agent a four-letter caller code; the backend maps it back to the number. Workers see the area and distance, never the customer's address, number or budget, until they are booked. Photos sit in a private bucket and go out as short-lived signed links.

Job states: `draft → confirmed → inviting → quotes_in → booked → done`, plus `cancelled` and `no_workers`. Only the moves listed in `backend/src/core/jobs.ts` are allowed.

```
backend/
  src/
    routes/       bolna.ts, whatsapp.ts, app.ts       (HTTP in, auth, raw logging)
    core/         card.ts                             (Bolna extraction → job card, worker quote)
                  jobs.ts                             (job states, WhatsApp summary, follow-ups)
                  quotes.ts, ranking.ts               (worker calls, scoring, shortlist, booking)
                  lookup.ts, calls.ts                 (pre-call lookup, call status, prank limits)
                  customer-app.ts, worker-app.ts      (web app actions)
    clients/      bolna.ts, whatsapp.ts, maps.ts, storage.ts   (each with an offline stand-in)
    db/           migrations/, seed.ts
  messages/       en.json, hi.json                    (every WhatsApp line)
  test/           unit tests; test/db/ for database tests
  simulator/      signed request replays
frontend/         Next.js 16 + shadcn: customer and worker web app
```

## Status

| Area | State |
|---|---|
| Customer call → job card → WhatsApp summary and follow-ups | Working on real phones |
| Worker calls, quotes, ranking, WhatsApp shortlist, booking | Working on real phones |
| Photos stored privately and forwarded to workers | Working |
| Customer and worker web app (login by WhatsApp code, quotes, start and finish codes, earnings) | Built; tested in the browser against the real backend on an isolated schema |
| Booking fee, cancellations, refunds | Built on the `revenue-model` branch, not merged yet |
| Live ops dashboard | Not built |
| "Was it fixed?", rating, free redo | Not built |
| Masked calling | Bolna call transfer while testing; Exotel later |
| Languages | Hindi and Hinglish; regional languages later |
| Outbound calling | Bolna trial account: only verified numbers, 2 calls at a time |
| WhatsApp | Meta test number: about 5 recipients, free-form messages only inside the 24-hour window |

## Deploying

The backend has a Railway config (`backend/railway.json`) and runs as one always-on process, because its timer loop must never sleep. For the buildathon it runs on a laptop behind a Cloudflare quick tunnel, whose URL changes on every restart; Bolna and Meta then need the new URL. The web app is planned for Vercel.

## Team

Built for the buildathon by the Suvidha team. Issues and suggestions are welcome on [GitHub](https://github.com/sounishant/suvidha).
