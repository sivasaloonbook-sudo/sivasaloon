-- ============================================================
-- Siva Saloon — Supabase Schema
-- Run this once in the Supabase SQL editor (or via CLI migration)
-- ============================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "uuid-ossp";

-- ---------- CUSTOMERS ----------
-- OTP-authenticated customers (MSG91). Auth is handled outside Supabase Auth,
-- so we keep our own customers table keyed by mobile number.
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  mobile text unique not null,
  name text,
  email text,
  address text,
  profile_photo_url text,
  otp_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- ADMINS ----------
create table if not exists admins (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  password_hash text not null,
  full_name text,
  role text default 'admin', -- admin | super_admin
  created_at timestamptz default now()
);

-- ---------- EMPLOYEES ----------
-- Each active employee = +1 chair/slot capacity per time slot.
create table if not exists employees (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  mobile text,
  photo_url text,
  is_active boolean default true,
  joined_on date default current_date,
  created_at timestamptz default now()
);

-- ---------- SERVICES ----------
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  name text not null,           -- e.g. Haircut
  duration_minutes int not null default 20,
  price numeric(10,2) not null default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ---------- BOOKING SLOTS ----------
-- Generated per day per employee based on shop hours (10:00–21:00,
-- minus 13:00–13:30 lunch) and service duration (20 min default).
create table if not exists booking_slots (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references employees(id) on delete cascade,
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  is_booked boolean default false,
  created_at timestamptz default now(),
  unique (employee_id, slot_date, start_time)
);

-- ---------- COUPONS ----------
create table if not exists coupons (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  discount_type text not null default 'percent', -- percent | flat
  discount_value numeric(10,2) not null,
  max_discount numeric(10,2),
  valid_from date,
  valid_to date,
  usage_limit int,
  times_used int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ---------- BOOKINGS ----------
create table if not exists bookings (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  employee_id uuid references employees(id),
  service_id uuid references services(id),
  slot_id uuid references booking_slots(id),
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  status text default 'pending', -- pending | confirmed | completed | cancelled
  coupon_id uuid references coupons(id),
  final_amount numeric(10,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- PAYMENTS ----------
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references bookings(id) on delete cascade,
  amount numeric(10,2) not null,
  method text, -- cash | upi | card | qr
  status text default 'pending', -- pending | verified | rejected
  reference_number text,
  verified_by uuid references admins(id),
  verified_at timestamptz,
  created_at timestamptz default now()
);

-- ---------- BILLS ----------
create table if not exists bills (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references bookings(id) on delete cascade,
  invoice_number text unique not null,
  subtotal numeric(10,2) not null,
  discount numeric(10,2) default 0,
  total numeric(10,2) not null,
  payment_status text default 'unpaid', -- unpaid | paid
  pdf_url text,
  created_at timestamptz default now()
);

-- ---------- SETTINGS ----------
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

insert into settings (key, value) values
  ('shop_hours', '{"open": "10:00", "close": "21:00"}'),
  ('lunch_break', '{"start": "13:00", "end": "13:30"}'),
  ('slot_duration_minutes', '20')
on conflict (key) do nothing;

-- ---------- NOTIFICATIONS ----------
-- Log of Telegram messages sent, for auditing/debugging.
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references bookings(id) on delete set null,
  type text not null, -- booking_created | booking_cancelled | payment_verified
  message text,
  sent_successfully boolean default false,
  created_at timestamptz default now()
);

-- ---------- INDEXES ----------
create index if not exists idx_bookings_date on bookings(booking_date);
create index if not exists idx_bookings_customer on bookings(customer_id);
create index if not exists idx_slots_date_employee on booking_slots(slot_date, employee_id);

-- ---------- ROW LEVEL SECURITY ----------
-- Enable RLS; policies to be refined once auth flow (OTP + admin login) is wired.
alter table customers enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;
alter table bills enable row level security;

-- Placeholder: service_role (used by server-side functions) bypasses RLS by default.
-- Add customer-scoped policies once MSG91 OTP session -> customer_id mapping is finalized.
