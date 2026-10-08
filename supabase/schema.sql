-- «Срез» — Supabase schema (rebuild, 2026-10)
-- Run whole in Supabase Dashboard → SQL Editor → New query.
-- DESTRUCTIVE: drops the previous tables and everything in them.

drop table if exists wallets cascade;
drop table if exists snapshots cascade;
drop table if exists settings cascade;
drop table if exists places cascade;

-- A place where money is or was kept. Name and category are live: editing
-- them regroups history. Currency is fixed once amounts exist (enforced in the app).
create table places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null check (length(trim(category)) > 0),
  currency text not null check (currency in ('RUB', 'USD', 'EUR', 'BTC')),
  form text not null default 'none' check (form in ('cash', 'noncash', 'none')),
  sort_order integer not null default 0,
  chain text check (chain in ('ethereum', 'bitcoin', 'solana')),
  address text,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  check ((chain is null) = (address is null))
);

-- One snapshot per month. Amounts and rates are immutable: no update grant.
create table snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  snapshot_date date not null,
  usdt_rub numeric not null check (usdt_rub > 0),
  eur_usd numeric check (eur_usd > 0),
  btc_usd numeric not null check (btc_usd > 0),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  reported_total_rub numeric,
  source text not null check (source in ('import', 'manual')),
  check (source <> 'import' or reported_total_rub is not null),
  created_at timestamptz not null default now(),
  unique (user_id, period)
);

create table settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  unisat_api_key text,
  coingecko_api_key text,
  updated_at timestamptz not null default now()
);

alter table places enable row level security;
alter table snapshots enable row level security;
alter table settings enable row level security;

create policy places_owner on places
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy snapshots_owner on snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy settings_owner on settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Revoke defensively in case the project ever grants new public tables to API roles, then give logged-in users only what the app needs.
revoke all on places, snapshots, settings from anon, authenticated;
-- No delete: snapshots reference places only inside jsonb and cannot be updated, so deleting a place with history would orphan its amounts.
grant select, insert, update on places to authenticated;
grant select, insert on snapshots to authenticated;
grant select, insert, update on settings to authenticated;
