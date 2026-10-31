# Suvidha

**Call once. We find the worker.**
Household repairs for Tier 2 and Tier 3 India, booked with a single phone call.

**Website:** [suvidha-red.vercel.app](https://suvidha-red.vercel.app) (try it live in the browser, or log in to the web app) · **Backend health:** [suvidha-backend-b88r.onrender.com/health](https://suvidha-backend-b88r.onrender.com/health)

**[The problem](#the-problem) · [Our answer](#our-answer) · [How it works](#how-it-works) · [Pricing](#pricing-and-money) · [Trust and safety](#trust-and-safety) · [Results](#results-so-far) · [Architecture](#architecture) · [Run it](#run-it-yourself) · [Status](#status)**

## The problem

Organised home services in India were built for the big cities. Urban Company, the category leader, operates in about 48 Indian cities ([DRHP, December 2024](https://inc42.com/buzz/urban-company-files-drhp-for-inr-1900-cr-ipo/)), concentrated in the largest metros, in a country of thousands of towns. Its own results now point to Tier 2 cities as the fastest-growing part of demand ([Q1 FY27 results](https://uc-investor-reports.s3.ap-southeast-1.amazonaws.com/Urban_Company_Q1%20FY27_results_Press_release.pdf)). The need is the same everywhere (a leaking tap, a fan that stopped, a door that won't shut), but in Tier 2 and Tier 3 towns nobody serves it properly.

The reason is not a lack of workers. It is two kinds of friction:

- **People don't want another app.** In a smaller town, getting something fixed has always meant one thing: call someone you know. Downloading an app, filling forms, comparing listings and paying online all stand between the household and a worker who is really just one phone call away. So marketplaces see few downloads and fewer repeat users.
- **Supply and demand never meet.** Most households rely on one regular plumber or electrician. When that person is busy, out of town or simply not picking up, the family is stuck, even though another skilled worker a few streets away may be sitting idle that very afternoon. There is no simple way for the household to find that worker, and no way for the worker to find the job.

So the work is there, and the workers are there. What is missing is a way to connect them that fits how people in these towns already behave.

## Our answer

Suvidha keeps the habit people already have, **making one phone call**, and does the organising behind it.

The customer calls the Suvidha number and describes the problem in Hindi or Hinglish, just as they would to a neighbour. An AI voice agent understands the job, and then **phones nearby workers on the customer's behalf**, gets a firm price and arrival time from each, and sends the customer a short list on WhatsApp. One tap books the worker.

- **For households:** no app, no forms, no searching. One call, then pick a worker on WhatsApp, which they already use every day.
- **For workers:** no app needed either. They get a phone call about a job near them, say their rate, and get the work. Idle hours become paid hours, and they keep 100% of their price.
- **For the town:** the idle worker nearby and the household that needs them finally meet, within minutes.

## How it works

```
 Customer ──calls──▶ Suvidha voice agent (Hindi / Hinglish)
                        │  listens to the problem, asks only what is missing, reads it back
                        ▼
                    Job card  (trade, problem, material, area, deadline, what matters most)
                        │
                        ├──▶ WhatsApp to customer: summary + "send a photo"
                        ▼
                    Worker calls  (same trade, right skill first, then nearest; 2 at a time)
                        │  each worker hears the job and gives one fixed price and a time
                        ▼
                    Ranking  (speed · price · quality, weighted by what the customer cares about)
                        ▼
 Customer ◀──WhatsApp── Shortlist with a reason for each worker ──tap──▶ pay booking fee ──▶ Booked
                        │
                        ├──▶ Customer: worker's name, arrival time, price, start code
                        └──▶ Worker: full address, site contact, safety note
```

### 1. One call builds the job

The customer is greeted with "Main Suvidha AI hoon. Batayiye, kya problem hai?" and simply tells the story. The agent asks only the questions still missing for that kind of job (for example, "Do you already have the new tap, or should the worker bring one?"), reads everything back, and hangs up. A structured job card is filled from that confirmed read-back. If anything is still missing, Suvidha asks once on WhatsApp instead of calling back. The customer can also send a photo, which goes to the workers.

### 2. Workers are called, not broadcast to

A minute after the job card is complete, the second voice agent starts calling workers of that trade: two at a time, those with the right skill first, then the nearest. Each worker hears the job, the area and the deadline, and is asked for **one fixed price** (or a fixed visit charge if the job must be seen first) and when they can start. The same job card and photo reach them on WhatsApp at the same moment. Calling stops at 3 quotes or 4 calls, whichever comes first, so no worker's time is wasted.

### 3. The customer chooses, with reasons

Every quote is scored on speed, price and rating, weighted by what the customer said bothered them most last time: a worker who came late, overcharged, or did poor work. The shortlist arrives as a WhatsApp list, each worker with a one-line reason such as "Earliest arrival: today 5:30 pm". The customer taps a worker, pays the small booking fee, and the booking is confirmed for both sides.

### 4. The job gets done

The worker taps **On my way** on WhatsApp, and the customer is told the worker is coming. At the door, the customer gives the worker a **start code**; when the work is done, a **finish code** closes the job. The customer pays the worker's price directly to the worker.

### Optional web app

Customers who prefer a screen can sign in with a code sent on WhatsApp to see their jobs, compare prices and book. Workers have their own simple app to see job requests, send a price, step through a booking with the start and finish codes, and track their earnings. The phone call and WhatsApp remain the main way to use Suvidha; the app is extra, never required.

### Try it from the website

- **Try it live:** talk to the real Customer Agent from the browser. Your WhatsApp messages appear on a phone on the page, and demo workers send their rates, so nobody's real phone rings. Up to 50 calls a day.
- **Watch a real job:** a replay of a real booking in Roorkee, with both call recordings, the WhatsApp messages and the job card, from the first hello to a booked worker.

## Pricing and money

| Who | Pays | Gets |
|---|---|---|
| Customer | A small booking fee when they confirm a worker: **₹29** for jobs under ₹500, **₹49** up to ₹1,999, **₹99** from ₹2,000 | A verified, nearby worker at a fixed price, booked in minutes |
| Worker | Nothing per job | **100% of their price**, paid directly by the customer |

- The fee is paid through a link on WhatsApp, valid for 5 minutes. The booking is confirmed only once it is paid; if it isn't, the customer can simply choose again.
- **Cancelling is fair to whoever didn't cause it.**
  - The customer cancels before the worker has set out: full refund.
  - The customer cancels after the worker set out: ₹25 goes to the worker for their travel, the rest comes back.
  - The worker cancels, Suvidha cancels, or the worker doesn't turn up: full refund plus ₹25 credit as an apology.
- Credit never expires and is used first on the next booking fee. The balance is shown in every booking message.
- A worker who doesn't turn up is called last for the next 2 days.

Payments run in a test mode for now; a payment provider (UPI links) plugs in at the same place.

## Trust and safety

- **Privacy by default.** Before a worker is booked, they see only the area and the distance, never the customer's address, phone number or budget. The AI agents never see phone numbers at all; they work with short caller codes.
- **Codes at the door.** The start and finish codes make sure the right worker starts the job and the customer agrees it is done.
- **Photos stay private.** They are stored in a private bucket and shared with workers only as short-lived links.
- **Prank and abuse limits.** Repeated or abusive callers are limited and flagged automatically.

## Results so far

Tested end to end on real phones in Roorkee (October 2026):

- **About 1.5 minutes** for a customer's intake call (median across 17 calls with customers and workers).
- **Under 4 minutes** from the customer hanging up to a booked worker, in every test (2 min 41 s to 3 min 54 s), most of it the worker's own call.
- The caller lookup that runs before every call answers in under a second.

## Architecture

```
 Phone calls ──▶ Bolna voice agents ──webhooks──┐
 WhatsApp    ──▶ Meta Cloud API     ──webhooks──┼──▶  Backend (Node 24, Express)  ──▶  Supabase Postgres + Storage
 Web app     ──▶ Next.js (server)   ──/app API──┘         │
                                                           └──▶ Google Maps (area and distance)
```

- **Backend:** TypeScript on Node 24 with Express, plain SQL through postgres.js, and Zod checks at every boundary. Phone calls, WhatsApp and the web app all call the same core functions, so a booking behaves the same whichever way it was made.
- **Every request is checked, saved, then deduplicated.** Bolna requests carry a token and Meta's are signed. Each one is stored raw before anything acts on it, so any run can be traced call by call, and repeats are ignored.
- **Timers live in the database.** Every wait (start calling workers in a minute, give up on an unanswered call, expire an unpaid booking) is a time stored on the job. A loop acts on whatever is due, so a restart loses nothing.
- **Job states:** `draft → confirmed → inviting → quotes_in → awaiting_payment → booked → done`, plus `cancelled` and `no_workers`. Only allowed moves can happen.
- **Web app:** Next.js 16 with shadcn. The browser never talks to the backend directly; the Next.js server does, with a shared token and the user's session. The one exception is Try it live, which uses its own public `/demo` endpoints: a signed token per visitor, demo numbers only, and a daily cap.

```
backend/
  src/
    routes/     bolna.ts, whatsapp.ts, app.ts, pay.ts, demo.ts   (HTTP in: auth, raw logging)
    core/       card.ts          (call extraction → job card, worker quote)
                jobs.ts          (job states, WhatsApp summary, follow-up questions)
                quotes.ts        (worker calls, shortlist)    ranking.ts (scoring)
                bookings.ts      (booking fee, payment, booking)
                cancellations.ts (cancelling, refunds, credit, travel pay)
                customer-app.ts, worker-app.ts   (web app)
    clients/    bolna, whatsapp, maps, storage, payments   (each with an offline stand-in)
    db/         migrations/, seed.ts
  messages/     en.json, hi.json   (every WhatsApp line, English and Hinglish)
  test/         unit tests; test/db/ for database tests
frontend/       Next.js landing page (Try it live, real-job replay) and the customer and worker web app
```

## Run it yourself

You need Node 24, a Supabase project, a Bolna account with two agents (customer and worker), a Meta WhatsApp Cloud API number and a Google Maps key.

```bash
git clone https://github.com/sounishant/suvidha.git && cd suvidha
cp .env.example .env                 # fill in every key

cd backend
npm install
npm run migrate && npm run seed      # database schema, task catalogue, demo workers
npm run create-photo-bucket          # private storage for job photos
npm run dev                          # http://localhost:8080

cd ../frontend
npm install
npm run dev                          # http://localhost:3000
```

For local testing, expose the backend with a tunnel (for example `cloudflared tunnel --url http://localhost:8080`) and point Bolna and Meta at it:

| Endpoint | Used by |
|---|---|
| `/health` | Health check (backend and database) |
| `/bolna/lookup/customer`, `/bolna/lookup/worker` | Bolna, before answering a call |
| `/bolna/webhook/call` | Bolna, for every call update; the job card and quotes arrive here |
| `/whatsapp/webhook` | Meta, for replies, button taps and photos |
| `/pay/<id>` | Booking fee payment page |
| `/app/*` | The web app's server only |

The customer agent needs the "Job Card" extraction fields and the worker agent the "Quote" fields; the names the backend reads are in `backend/src/core/card.ts`. The web app reads `BACKEND_URL` and `APP_API_TOKEN`.

**Tests:** `npm run typecheck`, `npm test` (99 unit tests) and `npm run test:db` (56 database tests, including full call-to-booking, payment, cancellation and website demo flows, in their own schema). `npm run sim` replays signed Bolna and WhatsApp requests against a running server.

**Deploying:** the backend runs on Render as a single web service (root folder `backend`, build `npm ci`, start `npm run migrate && npm start`, health check `/health`, Node 24). It must never sleep, because its timer loop drives the worker calls, so an uptime monitor pings `/health` every 5 minutes. The web app runs on Vercel with `frontend` as the root folder and two settings: `BACKEND_URL` (the backend's address) and `APP_API_TOKEN` (the same token the backend has).

## Status

| Area | State |
|---|---|
| Customer call → job card → WhatsApp summary and follow-ups | Working on real phones |
| Worker calls, one fixed price each, ranking, WhatsApp shortlist | Working on real phones |
| Booking fee, cancellations, refunds, credit | Built and tested; payments in test mode |
| Customer and worker web app | Built and tested against the real backend |
| Website: landing page, Try it live, real-job replay | Live |
| Photos stored privately and shared with workers | Working |
| Languages | Hindi and Hinglish on calls; WhatsApp in Hinglish or English |
| Next | Real UPI payments, "Was it fixed?" with ratings and free redo, a worker "available today" status, regional languages, masked calling |

## Team

Built by the Suvidha team. Questions and suggestions are welcome on [GitHub](https://github.com/sounishant/suvidha).
