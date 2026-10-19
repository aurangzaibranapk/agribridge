-- Rollback 595: anon ko in teen tables ka poora SELECT wapas (purani haalat).
-- Sirf zaroorat par chalayein -- is se kharid ki qeemat dobara public ho jati hai.
grant select on public.products to anon;
grant select on public.stock_batches to anon;
grant select on public.customers to anon;
comment on column public.products.purchase_price is null;
