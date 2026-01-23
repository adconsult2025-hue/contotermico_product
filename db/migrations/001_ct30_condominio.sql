-- TERMO 3.0 — Condominio schema (Supabase/Postgres)
create extension if not exists pgcrypto;

-- Condominiums master
create table if not exists public.ct_condominiums (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  name text not null,
  fiscal_code text null,
  address text null,
  city text null,
  province text null,
  cap text null,
  administrator_name text null,
  administrator_email text null,
  administrator_phone text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Units inside condominium (PA/Office/Private etc.)
create table if not exists public.ct_units (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.ct_condominiums(id) on delete cascade,
  owner_user_id uuid not null,
  unit_code text null, -- interno / scala / subalterno
  unit_type text not null default 'PRIVATO', -- PRIVATO | UFFICIO | PA | TERZO_SETTORE | ALTRO
  surface_m2 numeric null,
  millesimi numeric null,
  pod text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional: ownership/subjects linked to a unit (for riparti, intestazioni)
create table if not exists public.ct_unit_owners (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.ct_units(id) on delete cascade,
  owner_user_id uuid not null,
  full_name text not null,
  fiscal_code text null,
  email text null,
  phone text null,
  share_pct numeric null, -- 0-100
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_ct_condominiums_owner on public.ct_condominiums(owner_user_id);
create index if not exists idx_ct_units_condo on public.ct_units(condominium_id);
create index if not exists idx_ct_units_owner on public.ct_units(owner_user_id);
create index if not exists idx_ct_unit_owners_unit on public.ct_unit_owners(unit_id);

-- Enable RLS
alter table public.ct_condominiums enable row level security;
alter table public.ct_units enable row level security;
alter table public.ct_unit_owners enable row level security;

-- Owner OR superadmin policies (requires public.app_superadmins(user_id uuid))
drop policy if exists ct_condominiums_owner_or_superadmin on public.ct_condominiums;
create policy ct_condominiums_owner_or_superadmin
on public.ct_condominiums
for all
using (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
)
with check (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
);

drop policy if exists ct_units_owner_or_superadmin on public.ct_units;
create policy ct_units_owner_or_superadmin
on public.ct_units
for all
using (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
)
with check (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
);

drop policy if exists ct_unit_owners_owner_or_superadmin on public.ct_unit_owners;
create policy ct_unit_owners_owner_or_superadmin
on public.ct_unit_owners
for all
using (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
)
with check (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
);
