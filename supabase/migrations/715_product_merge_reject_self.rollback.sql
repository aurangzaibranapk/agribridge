-- Rollback 715 — purana check wapas. Reject of a grandfathered self-merge
-- phir se usi CHECK par ruk jayega. NOT VALID, taake jo row pehle hi
-- rejected ho chuki ho us par rollback fail na ho.
alter table public.product_merge_requests
  drop constraint if exists product_merge_requests_not_self;

alter table public.product_merge_requests
  add constraint product_merge_requests_not_self
  check (source_product_id <> target_product_id)
  not valid;
