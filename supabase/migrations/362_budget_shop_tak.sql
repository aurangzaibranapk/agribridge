-- =====================================================================
-- AgriBridge — Migration 362: Budget ab Shop (business unit) tak
-- =====================================================================
-- Malik (7 September): Branch ke andar kai shop hain (Karyana, Agri
-- Inputs, Vets, Milk, Grain Procurement), aur har shop ka apna,
-- KHATE-WAR (GL account ke hisaab se) budget chahiye -- Branch budget
-- jaisa hi tafseeli, sirf ek Shop tak mehdood.
--
-- Ledger (journal_entries) khud sirf BRANCH tak jaata hai, Shop tak
-- nahi -- is liye "Shop ka asal kharcha" is table se seedha nahi milta.
-- Hal: har posting apna `source_module` + `source_id` rakhti hai
-- (kharche -> company_expense_requests.id, pos -> pos_sales.id), aur
-- dono tables mein `shop_id` pehle se maujood hai. Isi liye koi schema
-- badlaav journal_entries mein NAHI karna paRa -- `shopTrialBalance()`
-- isi purane raaste se guzar kar shop ka asal nikalta hai.
--
-- Trigger `branch_id` ko shop se khud bhar deta hai -- taake kabhi
-- aisi qatar na bane jis mein shop kisi aur branch ka ho aur branch_id
-- kisi aur ka likha ho.
-- =====================================================================

alter table public.budget_lines
  add column if not exists shop_id uuid references public.shops(id);

create index if not exists idx_budget_lines_shop on public.budget_lines(shop_id);

alter table public.budget_lines
  drop constraint if exists budget_lines_budget_account_branch_key;

alter table public.budget_lines
  add constraint budget_lines_budget_account_branch_shop_key
  unique nulls not distinct (budget_id, account_code, branch_id, shop_id);

create or replace function public.fn_budget_line_branch_from_shop()
returns trigger
language plpgsql
as $$
begin
  if new.shop_id is not null then
    select branch_id into new.branch_id from public.shops where id = new.shop_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_budget_line_branch_from_shop on public.budget_lines;
create trigger trg_budget_line_branch_from_shop
  before insert or update on public.budget_lines
  for each row execute function public.fn_budget_line_branch_from_shop();
