-- CT 3.0 - Calc runs & results (Supabase)
create extension if not exists pgcrypto;

create table if not exists public.ct_calc_runs (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.ct_practices(id) on delete cascade,
  owner_user_id uuid not null,
  engine_version text not null default 'stub-0.1',
  input_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ct_calc_runs_practice_idx on public.ct_calc_runs(practice_id);
create index if not exists ct_calc_runs_owner_idx on public.ct_calc_runs(owner_user_id);

alter table public.ct_calc_runs enable row level security;
drop policy if exists ct_calc_runs_owner_or_superadmin on public.ct_calc_runs;
create policy ct_calc_runs_owner_or_superadmin
on public.ct_calc_runs
for all
using (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
)
with check (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
);

create table if not exists public.ct_calc_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ct_calc_runs(id) on delete cascade,
  practice_id uuid not null references public.ct_practices(id) on delete cascade,
  owner_user_id uuid not null,
  scope text not null default 'practice', -- practice | intervention | unit
  ref_id uuid null,                      -- intervention_id or unit_id (optional)
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ct_calc_results_run_idx on public.ct_calc_results(run_id);
create index if not exists ct_calc_results_practice_idx on public.ct_calc_results(practice_id);
create index if not exists ct_calc_results_owner_idx on public.ct_calc_results(owner_user_id);

alter table public.ct_calc_results enable row level security;
drop policy if exists ct_calc_results_owner_or_superadmin on public.ct_calc_results;
create policy ct_calc_results_owner_or_superadmin
on public.ct_calc_results
for all
using (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
)
with check (
  owner_user_id = auth.uid()
  OR exists (select 1 from public.app_superadmins s where s.user_id = auth.uid())
);
