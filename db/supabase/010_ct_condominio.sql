-- CT 3.0 (TERMO 3.0) - Condominio: unità + interventi + checklist base

create extension if not exists pgcrypto;

-- Unità immobiliari collegate a una pratica
create table if not exists public.ct_units (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ct_practices(id) on delete cascade,
  owner_user_id uuid not null,
  unit_code text,                 -- es. "INT. 3", "Scala A - 2°p"
  unit_type text not null default 'residenziale', -- 'pa' | 'ufficio' | 'residenziale' | 'altro'
  millesimi numeric,              -- opzionale
  eligible_pct numeric,           -- es. 100 / 65 / 0 (calcolabile)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ct_units_practice_idx on public.ct_units(practice_id);
create index if not exists ct_units_owner_idx on public.ct_units(owner_user_id);

alter table public.ct_units enable row level security;

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

-- Interventi (minimo) collegati a una pratica
create table if not exists public.ct_interventions (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ct_practices(id) on delete cascade,
  owner_user_id uuid not null,
  intervention_code text not null,          -- es. "PDC", "FV_PDC", "INVOLUCRO"
  title text,
  data jsonb not null default '{}'::jsonb,  -- parametri tecnici/ammissibilità/costi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ct_interventions_practice_idx on public.ct_interventions(practice_id);
create index if not exists ct_interventions_owner_idx on public.ct_interventions(owner_user_id);

alter table public.ct_interventions enable row level security;

drop policy if exists ct_interventions_owner_or_superadmin on public.ct_interventions;
create policy ct_interventions_owner_or_superadmin
on public.ct_interventions
for all
using (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
)
with check (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
);

-- Checklist base per pratica (stato/adempimenti)
create table if not exists public.ct_checklist_items (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ct_practices(id) on delete cascade,
  owner_user_id uuid not null,
  code text not null,             -- es. "DELIBERA", "APE", "FATTURE", "ASSEVERAZIONE"
  label text not null,
  status text not null default 'todo',  -- todo | done | na
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(practice_id, code)
);

create index if not exists ct_checklist_practice_idx on public.ct_checklist_items(practice_id);
create index if not exists ct_checklist_owner_idx on public.ct_checklist_items(owner_user_id);

alter table public.ct_checklist_items enable row level security;

drop policy if exists ct_checklist_owner_or_superadmin on public.ct_checklist_items;
create policy ct_checklist_owner_or_superadmin
on public.ct_checklist_items
for all
using (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
)
with check (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
);
