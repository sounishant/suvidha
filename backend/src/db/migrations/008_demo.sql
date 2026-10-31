-- What the website demo's phone shows in place of WhatsApp for made-up +9100 numbers.
create table demo_messages (
  id          bigserial primary key,
  phone       text not null,
  kind        text not null,
  body        jsonb not null,
  created_at  timestamptz not null default now()
);
create index demo_messages_phone on demo_messages (phone, id);
alter table demo_messages enable row level security;

-- Demo workers in Civil Lines, Roorkee: three per trade so a demo job collects three quotes.
insert into workers (name, phone, trades, skills, locality, areas, working_hours, lat, lng, hours_start, hours_end,
                     language, has_smartphone, online, online_at, checks, verified, ai_call_consent_at, rating, rating_count)
select d.name, d.phone, array[d.trade],
       case d.trade
         when 'plumber' then array['tap_repair', 'flush_repair', 'pipe_leak', 'drain_block', 'washbasin_install', 'geyser_connection', 'new_fitting']
         when 'electrician' then array['switch_socket', 'fan', 'light', 'mcb_trip', 'wiring', 'appliance_install']
         else array['door_repair', 'window_repair', 'wardrobe_repair', 'bed_repair', 'table_repair', 'shelf_install', 'furniture_assembly', 'new_furniture', 'lock_hinge_handle']
       end,
       'Civil Lines', array['Civil Lines'], '8 am to 8 pm', d.lat, d.lng, '08:00', '20:00',
       'hi', true, true, now(), '{"id": true, "skills": true}', true, now(), d.rating, d.rating_count
from (values
  ('Ramesh Saini',      '+910000000101', 'plumber',     29.8671, 77.8893, 4.7, 38),
  ('Salim Ahmed',       '+910000000102', 'plumber',     29.8712, 77.8845, 4.5, 22),
  ('Deepak Kashyap',    '+910000000103', 'plumber',     29.8630, 77.8921, 4.9, 51),
  ('Mohit Sharma',      '+910000000201', 'electrician', 29.8689, 77.8870, 4.6, 29),
  ('Imran Khan',        '+910000000202', 'electrician', 29.8655, 77.8834, 4.8, 44),
  ('Arjun Pal',         '+910000000203', 'electrician', 29.8724, 77.8902, 4.3, 12),
  ('Raju Vishwakarma',  '+910000000301', 'carpenter',   29.8648, 77.8866, 4.8, 36),
  ('Suresh Dhiman',     '+910000000302', 'carpenter',   29.8702, 77.8911, 4.4, 19),
  ('Anil Kumar',        '+910000000303', 'carpenter',   29.8679, 77.8828, 4.6, 27)
) as d(name, phone, trade, lat, lng, rating, rating_count)
on conflict (phone) do nothing;
