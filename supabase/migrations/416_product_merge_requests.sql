-- =====================================================================
-- AgriBridge — Migration 416: Duplicate product ka merge — request + approval
-- =====================================================================
-- Malik (14 September, stock count safhe se): "koi product nikalni ho
-- to request ho jaye, double naam wali delete ho jaye, admin approval
-- de. Agar us ke against stock ho to wo duplicate naam par chala jaye
-- lakin stock duplicate na ho."
--
-- Yani: staff ek product ko doosre (asal) naam mein "milane" ki tajweez
-- bhej sakta hai. Tajweez bhejte waqt kuch nahi hilta -- Admin/Owner ki
-- tasdeeq par hi (a) source ka jo bhi stock hai wo TARGET mein chala
-- jata hai (har godam ke hisaab se, stock_movements se, seedha
-- inventory.quantity_on_hand chhED kar nahi -- 129 ka usool), aur
-- (b) source product `is_deleted=true` ho jata hai (record mehfooz,
-- hard delete nahi).

create table if not exists public.product_merge_requests (
  id uuid primary key default gen_random_uuid(),
  source_product_id uuid not null references public.products(id),
  target_product_id uuid not null references public.products(id),
  proposed_by uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Tajweez bhejte waqt jo stock dikha gaya tha, wahi yahan mehfooz --
  -- sirf record/audit ke liye. Amal (approval) LIVE stock par hota hai,
  -- is snapshot par nahi -- warna beech mein hui koi ginti/bikri gum ho
  -- sakti hai.
  source_stock_snapshot jsonb,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now()
);

alter table public.product_merge_requests enable row level security;

create policy "Authenticated can insert merge requests" on public.product_merge_requests
  for insert with check (true);
create policy "Staff can view merge requests" on public.product_merge_requests
  for select using (fn_is_any_staff());
create policy "Staff can update merge requests" on public.product_merge_requests
  for update using (fn_is_any_staff()) with check (fn_is_any_staff());

grant select, insert, update on public.product_merge_requests to authenticated;

comment on table public.product_merge_requests is
  'Staff ki tajweez: ek duplicate product ko doosre (asal) naam mein milana -- stock bhi sath jata hai, dobara nahi ginta (416).';
