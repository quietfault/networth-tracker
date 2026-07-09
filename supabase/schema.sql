-- Net Worth Tracker — Supabase schema
-- Выполнить целиком в Supabase Dashboard → SQL Editor → New query

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  chain text not null check (chain in ('ethereum', 'bitcoin', 'solana')),
  address text not null,
  created_at timestamptz not null default now()
);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null, -- '2024-12'
  snapshot_date date not null,
  assets jsonb not null default '{}'::jsonb, -- { banks, crypto, inventory, physical }
  usd_rub numeric,
  total_usd numeric,
  created_at timestamptz not null default now(),
  unique (user_id, period)
);

create table if not exists settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'USD',
  etherscan_api_key text,
  unisat_api_key text,
  updated_at timestamptz not null default now()
);

alter table wallets enable row level security;
alter table snapshots enable row level security;
alter table settings enable row level security;

create policy "wallets_owner" on wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "snapshots_owner" on snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "settings_owner" on settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Only logged-in users may touch these tables; RLS policies above then
-- restrict each authenticated user to their own rows via user_id.
grant select, insert, update, delete on wallets, snapshots, settings to authenticated;
