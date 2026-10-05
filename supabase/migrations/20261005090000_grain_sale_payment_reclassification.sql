-- Preserve old procurement payment rows while allowing a confirmed sale
-- conversion to move selected receipts into grain-sale receivables.
alter table public.grain_procurement_payments
  add column if not exists reclassified_as_sale_payment_id uuid references public.grain_sale_payments(id);

create index if not exists idx_grain_procurement_payment_sale_reclass
  on public.grain_procurement_payments(reclassified_as_sale_payment_id);
