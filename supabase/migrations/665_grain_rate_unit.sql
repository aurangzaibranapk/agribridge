-- 665: rate_per_kg ka matlab, bina paisa badle.
-- Khareed: column default per_maund (code pehle se kg/40 * rate karta hai).
-- Purani bikri (4 rows): rate column mein fi kg hai, is liye label per_kg.
-- total_amount jyon ka tyon. Nayi bikri jo column na bheje: default per_maund.
-- Paisa badalne wali SQL docs mein hai — needs owner approval. Yahan koi total update nahi.

alter table public.grain_procurement_entries
  add column if not exists rate_unit text default 'per_maund';

alter table public.grain_procurement_entries
  drop constraint if exists grain_procurement_entries_rate_unit_check;
alter table public.grain_procurement_entries
  add constraint grain_procurement_entries_rate_unit_check
  check (rate_unit is null or rate_unit in ('per_maund', 'per_kg', 'legacy_as_stored'));

alter table public.grain_sales
  add column if not exists rate_unit text default 'per_kg';

alter table public.grain_sales
  alter column rate_unit set default 'per_maund';

alter table public.grain_sales
  drop constraint if exists grain_sales_rate_unit_check;
alter table public.grain_sales
  add constraint grain_sales_rate_unit_check
  check (rate_unit is null or rate_unit in ('per_maund', 'per_kg', 'legacy_as_stored'));
