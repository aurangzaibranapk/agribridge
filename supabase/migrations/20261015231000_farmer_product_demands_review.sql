-- Demand Center review (maker-checker). NOT APPLIED anywhere.
-- Additive: naye nullable columns + status mein 'ordered'.
-- Staff (maker) recommend karta hai; Admin/Owner (checker, maker se alag)
-- approve / reject karta hai; phir approved -> ordered.

alter table public.farmer_product_demands
  add column if not exists recommended_action text
    check (recommended_action in ('approve','reject')),
  add column if not exists decided_by uuid references public.profiles(id),
  add column if not exists decided_at timestamptz,
  add column if not exists ordered_by uuid references public.profiles(id),
  add column if not exists ordered_at timestamptz;

alter table public.farmer_product_demands
  drop constraint if exists farmer_product_demands_status_check;
alter table public.farmer_product_demands
  add constraint farmer_product_demands_status_check
  check (status in ('pending','reviewing','approved','ordered','fulfilled','rejected','cancelled'));

-- Maker aur checker ek hi banda nahi ho sakta (DB bhi rokta hai).
alter table public.farmer_product_demands
  drop constraint if exists farmer_product_demands_checker_not_maker;
alter table public.farmer_product_demands
  add constraint farmer_product_demands_checker_not_maker
  check (decided_by is null or reviewed_by is null or decided_by <> reviewed_by);

create index if not exists farmer_product_demands_product_name_idx
  on public.farmer_product_demands (lower(product_name), status);
