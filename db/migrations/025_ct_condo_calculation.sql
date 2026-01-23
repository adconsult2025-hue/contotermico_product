-- CT 3.0: schema extensions for condos and unit-level allocation + incentives
-- Scope: condomini + unità immobiliari (riparto costi / opt-in / incentivi pratica)

create extension if not exists pgcrypto;

-- 1) Catalogo interventi CT (se non già presente in schema "core")
-- Nota: nel tuo schema completo esiste già ct_interventions (catalog). Qui lo creiamo solo se manca.
create table if not exists public.ct_interventions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null default 'GEN',
  description text not null default '',
  eligible_ct boolean not null default true,
  eligibility_condition text,
  created_at timestamptz not null default now()
);

-- 2) Interventi selezionati per pratica (uno per codice intervento)
create table if not exists public.ct_practice_interventions (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ct_practices(id) on delete cascade,
  intervention_code text not null references public.ct_interventions(code),
  note text,
  created_at timestamptz not null default now(),
  is_combined_insulation boolean default false,
  unique(practice_id, intervention_code)
);
create index if not exists idx_ct_practice_interventions_practice on public.ct_practice_interventions(practice_id);

-- 3) Unità immobiliari (versione “condominio” legata alla pratica)
-- Nota: nel tuo schema completo esiste già ct_condo_units; qui la creiamo se manca, senza rompere l’esistente.
create table if not exists public.ct_condo_units (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ct_practices(id) on delete cascade,
  sub_code text not null,
  unit_label text,
  use_type text not null,          -- RESIDENZIALE | UFFICI | ...
  beneficiary_type text not null,  -- PRIVATO | PA | ETS
  millesimi numeric not null default 0,
  owner_name text,
  cf_piva text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(practice_id, sub_code)
);
create index if not exists idx_ct_condo_units_practice on public.ct_condo_units(practice_id);
create index if not exists idx_ct_condo_units_active on public.ct_condo_units(practice_id, is_active);

-- 4) Riparto intervento→unità (quota percentuale + costi/quantità eleggibili per unità)
create table if not exists public.ct_practice_intervention_units (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ct_practices(id) on delete cascade,
  intervention_id uuid not null references public.ct_practice_interventions(id) on delete cascade,
  unit_id uuid not null references public.ct_condo_units(id) on delete cascade,
  share_pct numeric(7,4) not null default 0,         -- 0..1 oppure 0..100? (qui assumiamo 0..1)
  eligible_cost_eur numeric(14,2),
  qty numeric(14,4),
  uom text,
  notes text,
  created_at timestamptz not null default now(),
  unique(intervention_id, unit_id)
);
create index if not exists idx_ct_pi_units_practice on public.ct_practice_intervention_units(practice_id);
create index if not exists idx_ct_pi_units_intervention on public.ct_practice_intervention_units(intervention_id);
create index if not exists idx_ct_pi_units_unit on public.ct_practice_intervention_units(unit_id);

-- 5) Opt-in per unità (unità che partecipano o no ad un intervento, e metodo di riparto)
create table if not exists public.ct_unit_intervention_optins (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ct_practices(id) on delete cascade,
  unit_id uuid not null references public.ct_condo_units(id) on delete cascade,
  intervention_code text not null references public.ct_interventions(code) on delete restrict,
  opt_in boolean not null default true,
  allocation_method text not null default 'MILLESIMI', -- MILLESIMI | PERCENT | DIRECT
  allocation_value numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  direct_cost_eur numeric,
  direct_qty numeric,
  unique(practice_id, unit_id, intervention_code)
);
create index if not exists idx_ct_optins_practice on public.ct_unit_intervention_optins(practice_id);
create index if not exists idx_ct_optins_unit on public.ct_unit_intervention_optins(unit_id);

-- 6) Incentivi calcolati a livello pratica (totale lordo/netto + dettagli)
create table if not exists public.ct_practice_incentives (
  practice_id uuid primary key references public.ct_practices(id) on delete cascade,
  version_code text not null default 'CT3_DM_2025_08_07',
  computed_at timestamptz not null default now(),
  subject_type text,
  climate_zone text,
  building_scope text,
  cap_rate numeric,
  total_gross numeric not null default 0,
  total_net numeric not null default 0,
  duration_years integer not null default 5,
  rates jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb
);
create index if not exists idx_ct_practice_incentives_version on public.ct_practice_incentives(version_code);

-- 7) VISTA comoda per bucket beneficiario/building scope (per UI e regole)
create or replace view public.ct_condo_units_v as
select
  u.*,
  case when upper(u.use_type) = 'RESIDENZIALE' then 'RESIDENZIALE' else 'TERZIARIO' end as building_scope,
  case
    when upper(u.beneficiary_type) = 'PA' then 'PA'
    when upper(u.beneficiary_type) = 'ETS' then 'ETS'
    when upper(u.beneficiary_type) = 'PRIVATO' and upper(u.use_type) = 'RESIDENZIALE' then 'PRIVATO_RESIDENZIALE'
    when upper(u.beneficiary_type) = 'PRIVATO' and upper(u.use_type) <> 'RESIDENZIALE' then 'PRIVATO_TERZIARIO'
    else 'PRIVATO_TERZIARIO'
  end as beneficiary_bucket
from public.ct_condo_units u;
