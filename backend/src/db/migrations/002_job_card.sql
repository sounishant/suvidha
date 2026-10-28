-- Short codes the voice agents carry through a call, since Bolna can't pass the caller's number into a function.
create table caller_refs (
  ref           text primary key,
  line          text not null check (line in ('customer', 'worker')),
  phone         text not null,
  execution_id  text unique,
  created_at    timestamptz not null default now()
);

create index caller_refs_phone on caller_refs (phone, created_at);

-- Workers quote and the customer chooses: no one-at-a-time offers and no fixed rate card.
alter table jobs drop constraint jobs_trade_job_type_fkey;
drop table offers;
drop table rate_card;

alter table jobs drop constraint jobs_status_check;
update jobs set status = case
  when status = 'awaiting_confirm' then 'draft'
  when status = 'confirmed' then 'confirmed'
  when status in ('dispatching', 'unfilled') then 'no_workers'
  when status in ('assigned', 'en_route', 'started') then 'booked'
  when status in ('done', 'closed', 'redo_requested') then 'done'
  else 'cancelled' end;
alter table jobs add constraint jobs_status_check check (status in (
  'draft', 'confirmed', 'inviting', 'quotes_in', 'booked', 'done', 'cancelled', 'no_workers'));

alter table jobs drop constraint jobs_urgency_check;
update jobs set urgency = case when urgency = 'urgent' then 'today' else 'this_week' end;
alter table jobs alter column urgency drop not null;
alter table jobs add constraint jobs_urgency_check check (urgency in ('today', 'tomorrow', 'this_week', 'flexible'));

alter table jobs rename column address to locality;
alter table jobs rename column time_window to time_window_text;
alter table jobs
  drop column price_kind,
  drop column intake_execution_id,
  drop column dispatch_round,
  drop column exploration,
  alter column job_type  drop not null,
  alter column problem   drop not null,
  alter column locality  drop not null,
  alter column lat       drop not null,
  alter column lng       drop not null,
  alter column price_inr drop not null,
  add column ref               text not null unique,
  add column caller_ref        text unique references caller_refs (ref),
  add column channel           text not null default 'call' check (channel in ('call', 'app')),
  add column execution_id      text unique,
  add column job_type_other    text,
  add column material          text check (material in ('customer_has', 'worker_brings', 'not_sure')),
  add column address           text,
  add column site_contact      text,
  add column window_start      timestamptz,
  add column window_end        timestamptz,
  add column priorities        text[] not null default '{}',
  add column budget_inr        integer check (budget_inr > 0),
  add column safety_note       text,
  add column complexity        text check (complexity in ('standard', 'custom', 'unclear')),
  add column needs_visit       boolean not null default false,
  add column missing_fields    text[] not null default '{}',
  add column pending_question  text,
  add column customer_notes    text[] not null default '{}',
  add column consent           jsonb not null default '{}',
  add column messages_sent     jsonb not null default '{}',
  add column status_updated_at timestamptz not null default now(),
  add column invited_at        timestamptz;

alter table workers add column trades text[] not null default '{}';
update workers set trades = array[trade];
alter table workers
  drop column trade,
  add column areas          text[] not null default '{}',
  add column skills_text    text,
  add column working_hours  text,
  add column blocked        boolean not null default false,
  alter column hours_start  drop not null,
  alter column hours_end    drop not null,
  alter column lat          drop not null,
  alter column lng          drop not null;

-- null = not known yet; false once a WhatsApp message to this number has failed.
alter table customers add column has_whatsapp boolean;

-- One row per worker we call for a job; the quote fields fill in once he has answered.
create table quotes (
  id                 uuid primary key default gen_random_uuid(),
  ref                text not null unique,
  job_id             uuid not null references jobs(id),
  worker_id          uuid not null references workers(id),
  call_order         integer not null,
  distance_km        real,
  bolna_execution_id text unique,
  call_status        text not null default 'calling' check (call_status in ('calling', 'answered', 'no_answer')),
  called_at          timestamptz not null default now(),
  next_action_at     timestamptz,
  available          boolean,
  decline_reason     text check (decline_reason in ('busy', 'too_far', 'not_my_skill', 'other')),
  price_type         text check (price_type in ('fixed', 'range', 'visit_only')),
  price_min          integer,
  price_max          integer,
  visit_charge       integer,
  material_included  text check (material_included in ('yes', 'no', 'partly')),
  earliest_arrival   timestamptz,
  duration_mins      integer,
  note               text,
  quoted_at          timestamptz,
  rank               integer,
  rank_group         text check (rank_group in ('ranked', 'visit', 'later')),
  rank_reason        text,
  score              real,
  unique (job_id, worker_id)
);

create index quotes_due on quotes (next_action_at) where next_action_at is not null;
create index quotes_worker on quotes (worker_id);

alter table bookings
  add column quote_id uuid unique references quotes(id),
  alter column eta_at drop not null;

-- Append-only log for metrics; nothing in the product reads it.
create table events (
  id          bigint generated always as identity primary key,
  job_id      uuid references jobs(id),
  event_type  text not null,
  actor       text not null,
  details     jsonb not null default '{}',
  at          timestamptz not null default now()
);

create index events_job on events (job_id, at);

alter table caller_refs enable row level security;
alter table quotes      enable row level security;
alter table events      enable row level security;
