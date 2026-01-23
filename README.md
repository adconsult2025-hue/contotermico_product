# contotermico_product

Piattaforma proprietaria per la gestione del Conto Termico 3.0.

## Setup Supabase CT3.0

1. Esegui la migrazione SQL presente in `supabase/sql/001_ct30_core.sql`.
2. Crea un bucket Storage chiamato `ct-docs` con visibilità **private**.
3. Applica la policy Storage per permettere lettura/scrittura solo sui percorsi che iniziano con lo UID dell'utente.

Esempio policy Storage (in console SQL Supabase):

```sql
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
```

© 2026 adconsult2025 – All rights reserved.
