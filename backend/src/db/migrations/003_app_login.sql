-- Web app login: a one-time code sent on WhatsApp, then a session the Next.js server holds in its own cookie.
create table login_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  role        text not null check (role in ('customer', 'worker', 'team')),
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index login_codes_phone on login_codes (phone, created_at);

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,
  phone         text not null,
  role          text not null check (role in ('customer', 'worker', 'team')),
  customer_id   uuid references customers(id),
  worker_id     uuid references workers(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz
);

alter table login_codes enable row level security;
alter table sessions    enable row level security;
