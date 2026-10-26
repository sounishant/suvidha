-- Supabase exposes every table through its public REST API. Row level security with no
-- policies keeps that API closed; the backend connects as the owner and is not affected.

create table workers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  phone               text not null unique,
  trade               text not null,
  skills              text[] not null default '{}',
  locality            text not null,
  lat                 double precision not null,
  lng                 double precision not null,
  radius_km           numeric(4,1) not null default 5,
  hours_start         time not null,
  hours_end           time not null,
  language            text not null,
  has_smartphone      boolean not null,
  online              boolean not null default false,
  online_at           timestamptz,
  checks              jsonb not null default '{}',
  verified            boolean not null default false,
  ai_call_consent_at  timestamptz not null,
  rating              numeric(2,1),
  rating_count        integer not null default 0,
  last_no_show_at     timestamptz,
  photo_url           text,
  created_at          timestamptz not null default now()
);

create table worker_stats (
  worker_id   uuid not null references workers(id) on delete cascade,
  job_type    text not null,
  time_band   text not null check (time_band in ('morning', 'afternoon', 'evening', 'night')),
  offers      real not null default 0,
  pickups     real not null default 0,
  accepts     real not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (worker_id, job_type, time_band)
);

create table customers (
  id                  uuid primary key default gen_random_uuid(),
  phone               text not null unique,
  name                text,
  preferred_language  text,
  last_address        text,
  last_lat            double precision,
  last_lng            double precision,
  completed_jobs      integer not null default 0,
  no_job_calls        integer not null default 0,
  flagged_at          timestamptz,
  blocked             boolean not null default false,
  created_at          timestamptz not null default now()
);

create table rate_card (
  trade       text not null,
  job_type    text not null,
  label       text not null,
  price_inr   integer not null check (price_inr >= 0),
  price_kind  text not null check (price_kind in ('fixed', 'visit')),
  primary key (trade, job_type)
);

-- Each trade has exactly one visit-charge row (job_type 'unclear').
create unique index rate_card_one_visit_per_trade on rate_card (trade) where price_kind = 'visit';

create table jobs (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references customers(id),
  language             text not null,
  trade                text not null,
  job_type             text not null,
  problem              text not null,
  address              text not null,
  landmark             text,
  lat                  double precision not null,
  lng                  double precision not null,
  urgency              text not null check (urgency in ('urgent', 'normal')),
  time_window          text,
  price_inr            integer not null,
  price_kind           text not null check (price_kind in ('fixed', 'visit')),
  photo_media_id       text,
  photo_url            text,
  status               text not null check (status in (
                         'awaiting_confirm', 'confirmed', 'dispatching', 'assigned', 'en_route',
                         'started', 'done', 'closed', 'expired', 'unfilled', 'redo_requested')),
  confirmed_at         timestamptz,
  dispatch_round       integer not null default 0,
  ranking              jsonb,
  exploration          boolean not null default false,
  next_action_at       timestamptz,
  intake_execution_id  text unique,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (trade, job_type) references rate_card (trade, job_type)
);

create index jobs_due on jobs (next_action_at) where next_action_at is not null;
create index jobs_customer on jobs (customer_id);
create index jobs_status on jobs (status);

create table offers (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references jobs(id),
  worker_id           uuid not null references workers(id),
  round               integer not null,
  rank_position       integer not null,
  score               real not null,
  p_pickup            real not null,
  p_accept            real not null,
  reason              text not null,
  channel             text not null check (channel in ('voice', 'voice+whatsapp')),
  sent_at             timestamptz not null default now(),
  bolna_execution_id  text unique,
  card_message_id     text unique,
  call_status         text,
  picked_up           boolean not null default false,
  response            text check (response in ('accept', 'decline', 'missed')),
  response_channel    text check (response_channel in ('voice', 'whatsapp', 'app')),
  response_at         timestamptz,
  response_seconds    integer,
  arrival_minutes     integer,
  hour                smallint not null,
  distance_km         real not null,
  job_type            text not null,
  next_action_at      timestamptz,
  unique (job_id, worker_id)
);

create index offers_due on offers (next_action_at) where next_action_at is not null;
create index offers_worker on offers (worker_id, sent_at);

create table bookings (
  id                     uuid primary key default gen_random_uuid(),
  job_id                 uuid not null unique references jobs(id),
  worker_id              uuid not null references workers(id),
  start_otp              text not null check (start_otp ~ '^[0-9]{4}$'),
  completion_otp         text not null check (completion_otp ~ '^[0-9]{4}$'),
  eta_at                 timestamptz not null,
  confirmed_at           timestamptz not null default now(),
  trip_started_at        timestamptz,
  started_at             timestamptz,
  done_at                timestamptz,
  closed_at              timestamptz,
  actual_job_type        text,
  final_price_inr        integer,
  fixed                  boolean,
  rating                 smallint check (rating between 1 and 5),
  fee_status             text not null default 'mock_pending',
  arriving_soon_sent_at  timestamptz
);

create index bookings_worker on bookings (worker_id);

create table contacts (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid references jobs(id),
  person_kind         text not null check (person_kind in ('customer', 'worker')),
  person_phone        text not null,
  channel             text not null check (channel in ('voice', 'whatsapp')),
  direction           text not null check (direction in ('inbound', 'outbound')),
  agent_or_template   text not null,
  bolna_execution_id  text unique,
  wa_message_id       text unique,
  status              text,
  duration_sec        integer,
  cost_usd_cents      numeric(10,3),
  transcript          text,
  created_at          timestamptz not null default now()
);

create index contacts_job on contacts (job_id);
create index contacts_phone on contacts (person_phone, created_at);

create table location_pings (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references bookings(id),
  lat         double precision not null,
  lng         double precision not null,
  at          timestamptz not null default now()
);

create index location_pings_booking on location_pings (booking_id, at);

create table webhook_log (
  id           bigint generated always as identity primary key,
  source       text not null check (source in ('bolna_lookup', 'bolna_fn', 'bolna_call', 'whatsapp')),
  external_id  text,
  path         text not null,
  headers      jsonb not null,
  body         text not null,
  received_at  timestamptz not null default now()
);

create unique index webhook_log_dedup on webhook_log (source, external_id) where external_id is not null;

alter table workers        enable row level security;
alter table worker_stats   enable row level security;
alter table customers      enable row level security;
alter table rate_card      enable row level security;
alter table jobs           enable row level security;
alter table offers         enable row level security;
alter table bookings       enable row level security;
alter table contacts       enable row level security;
alter table location_pings enable row level security;
alter table webhook_log    enable row level security;
