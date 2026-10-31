-- =====================================================================
-- AgriBridge — Migration 740: Har chiller ka alag total
-- =====================================================================
-- Pehle ek branch + tareekh + shift ka sirf ek total tha. Ab har chiller
-- ka apna total, aur shift ka kul un ka jama. Rollback: 740 rollback.
-- =====================================================================

drop index if exists public.milk_chiller_totals_one;

create unique index if not exists milk_chiller_totals_per_chiller
  on public.milk_chiller_totals (branch_id, entry_date, shift, chiller_no);

comment on index public.milk_chiller_totals_per_chiller is
  'Har chiller ka ek total har shift mein (740).';
