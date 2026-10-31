-- Wrong start/finish codes typed by the worker; at 5 the booking stops accepting codes until the team steps in.
alter table bookings add column code_attempts integer not null default 0;
