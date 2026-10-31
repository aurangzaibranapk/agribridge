-- 740 rollback. Ek shift ka ek total wala index wapas (sirf agar har shift mein ek hi chiller ho).
drop index if exists public.milk_chiller_totals_per_chiller;
create unique index if not exists milk_chiller_totals_one
  on public.milk_chiller_totals (branch_id, entry_date, shift);
