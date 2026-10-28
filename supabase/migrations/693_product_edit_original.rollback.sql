-- Rollback 693
alter table public.product_merge_requests drop constraint if exists product_merge_requests_not_self;
alter table public.product_edit_requests drop column if exists original;
