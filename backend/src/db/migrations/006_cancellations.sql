alter table payments
  add column refunded_inr integer not null default 0 check (refunded_inr between 0 and amount_inr),
  add column refunded_at  timestamptz;

alter table credits drop constraint credits_reason_check;
alter table credits add constraint credits_reason_check check (reason in ('used', 'released', 'refund', 'apology'));

alter table bookings
  add column cancelled_at timestamptz,
  add column cancel_cause text check (cancel_cause in ('customer_before_trip', 'customer_after_trip', 'no_show', 'worker', 'suvidha'));

-- Money Suvidha sends to workers, e.g. travel pay when a customer cancels after the worker set out.
create table payouts (
  id          bigint generated always as identity primary key,
  worker_id   uuid not null references workers(id),
  job_id      uuid not null references jobs(id),
  amount_inr  integer not null check (amount_inr > 0),
  reason      text not null check (reason in ('travel')),
  provider    text not null,
  created_at  timestamptz not null default now()
);

alter table payouts enable row level security;
