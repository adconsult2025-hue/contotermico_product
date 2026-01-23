create extension if not exists pgcrypto;

create table if not exists ct_practices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  title text,
  subject_type text,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ct_subjects (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references ct_practices(id) on delete cascade,
  owner_user_id uuid not null,
  data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ct_documents (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references ct_practices(id) on delete cascade,
  owner_user_id uuid not null,
  kind text,
  filename text,
  storage_path text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists ct_events (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid references ct_practices(id) on delete cascade,
  owner_user_id uuid not null,
  type text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function ct_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger ct_practices_updated_at
before update on ct_practices
for each row execute function ct_set_updated_at();

create trigger ct_subjects_updated_at
before update on ct_subjects
for each row execute function ct_set_updated_at();

alter table ct_practices enable row level security;
alter table ct_subjects enable row level security;
alter table ct_documents enable row level security;
alter table ct_events enable row level security;

create policy ct_practices_owner_select on ct_practices
  for select using (owner_user_id = auth.uid());
create policy ct_practices_owner_insert on ct_practices
  for insert with check (owner_user_id = auth.uid());
create policy ct_practices_owner_update on ct_practices
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy ct_practices_owner_delete on ct_practices
  for delete using (owner_user_id = auth.uid());

create policy ct_subjects_owner_select on ct_subjects
  for select using (owner_user_id = auth.uid());
create policy ct_subjects_owner_insert on ct_subjects
  for insert with check (owner_user_id = auth.uid());
create policy ct_subjects_owner_update on ct_subjects
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy ct_subjects_owner_delete on ct_subjects
  for delete using (owner_user_id = auth.uid());

create policy ct_documents_owner_select on ct_documents
  for select using (owner_user_id = auth.uid());
create policy ct_documents_owner_insert on ct_documents
  for insert with check (owner_user_id = auth.uid());
create policy ct_documents_owner_update on ct_documents
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy ct_documents_owner_delete on ct_documents
  for delete using (owner_user_id = auth.uid());

create policy ct_events_owner_select on ct_events
  for select using (owner_user_id = auth.uid());
create policy ct_events_owner_insert on ct_events
  for insert with check (owner_user_id = auth.uid());
create policy ct_events_owner_update on ct_events
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy ct_events_owner_delete on ct_events
  for delete using (owner_user_id = auth.uid());

alter table storage.objects enable row level security;

create policy ct_docs_owner_rw on storage.objects
  for all
  using (
    bucket_id = 'ct-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'ct-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );
