-- A booking waits for the customer's booking fee.
alter table jobs drop constraint jobs_status_check;
alter table jobs add constraint jobs_status_check check (status in (
  'draft', 'confirmed', 'inviting', 'quotes_in', 'awaiting_payment', 'booked', 'done', 'cancelled', 'no_workers'));

-- The id goes into the payment link, so it must stay unguessable.
create table payments (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id),
  quote_id     uuid not null references quotes(id),
  customer_id  uuid not null references customers(id),
  fee_inr      integer not null check (fee_inr > 0),
  credit_inr   integer not null default 0 check (credit_inr between 0 and fee_inr),
  amount_inr   integer not null check (amount_inr = fee_inr - credit_inr),
  provider     text not null,
  link         text,
  status       text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  expires_at   timestamptz not null,
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);

create unique index payments_one_pending on payments (job_id) where status = 'pending';
create index payments_due on payments (expires_at) where status = 'pending';

-- Credit never expires; a customer's balance is the sum of their rows.
create table credits (
  id           bigint generated always as identity primary key,
  customer_id  uuid not null references customers(id),
  job_id       uuid references jobs(id),
  amount_inr   integer not null check (amount_inr <> 0),
  reason       text not null check (reason in ('used', 'released')),
  created_at   timestamptz not null default now()
);

create index credits_customer on credits (customer_id);

alter table bookings drop column fee_status;

alter table payments enable row level security;
alter table credits  enable row level security;
