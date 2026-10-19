-- Test-only extra stubs for 605-606 (on top of portal-khata + portal-customer stubs). PGlite only.
alter table public.farmers add column is_deleted boolean default false;
alter table public.pos_sales add column branch_id uuid;
alter table public.profiles add column full_name text;
