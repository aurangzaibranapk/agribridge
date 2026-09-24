-- =====================================================================
-- AgriBridge — Migration 361: Budget ab branch se jud sakta hai
-- =====================================================================
-- Malik (7 September): Branch ke andar kai shop/business unit (Karyana,
-- Agri Inputs, Vets, Milk, Grain Procurement) hain, aur har branch ka
-- apna consolidated budget chahiye -- "MAHABALI — SEPTEMBER BUDGET"
-- jaisa, jis mein har khate ka adad Mahabali ke liye alag ho sakta hai.
--
-- Migration 306 mein budget_lines company-wide tha (ek khata = ek hi
-- saalana adad, poore idare ke liye). Ab har khate ka adad BRANCH ke
-- hisaab se bhi alag rakha ja sakta hai -- `branch_id` khali (NULL) ho
-- to wohi purana company-wide adad hai, aur ye purana data bilkul
-- waisa hi chalta rehta hai.
--
-- `unique nulls not distinct` is liye taake company-wide (branch_id
-- NULL) ke liye bhi ek hi adad rahe -- do khali-branch qatarein
-- (dono NULL) bhi takraav samjhi jayen, jaisi purani `unique
-- (budget_id, account_code)` karti thi.
-- =====================================================================

alter table public.budget_lines
  add column if not exists branch_id uuid references public.branches(id);

create index if not exists idx_budget_lines_branch on public.budget_lines(branch_id);

alter table public.budget_lines
  drop constraint if exists budget_lines_budget_id_account_code_key;

alter table public.budget_lines
  drop constraint if exists budget_lines_budget_account_branch_key;

alter table public.budget_lines
  add constraint budget_lines_budget_account_branch_key
  unique nulls not distinct (budget_id, account_code, branch_id);
