-- Ginti mein farq (shortage) ko Sale Staff ke khate mein bhejna --
-- malik (15 September): "us farq ko sale staff ke khate mein ya loss
-- mein -- staff ko yahin farq bhej ke us se confirmation li jaye, phir
-- clear kiya jaye kis side jana hai."
--
-- Faisle (malik ke jawab): us shop ke Sale Staff zimmedar hain (1 ho
-- to poora us par, 2 ho to dono mein barabar baant); confirmation isi
-- Stock Count safhe par (WhatsApp nahi); confirm karne par asal
-- katauti hoti hai (staff_credit_ledger debit, tankhwah se katega).
--
-- Do table: ek "kitna kul farq, kis count ka" (request, sirf jama-
-- tafreeq/report ke liye), ek "kis staff ka KIS PRODUCT mein kitna
-- hissa, confirm hua ya nahi" (shares).
--
-- Malik (15 September, dobara): "review ke sath har product ke sath
-- button ho verify/acknowledge karne ka" -- yani ek lump-sum confirm
-- nahi, har product ka apna alag button. Is liye share seedha
-- stock_count_lines se juRa hai -- 2 staff aur 5 farq wali cheezen hon
-- to 10 alag qatarein banti hain, har ek apna confirm/decline rakhti
-- hai.

create table public.stock_count_liability_requests (
  id uuid primary key default gen_random_uuid(),
  count_id uuid not null references public.stock_counts(id),
  branch_id uuid references public.branches(id),
  total_short_value numeric not null,
  requested_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.stock_count_liability_shares (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.stock_count_liability_requests(id) on delete cascade,
  count_line_id uuid not null references public.stock_count_lines(id),
  product_name text not null,
  reason text,
  profile_id uuid not null references public.profiles(id),
  share_amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  resolved_at timestamptz
);

alter table public.stock_count_liability_requests enable row level security;
alter table public.stock_count_liability_shares enable row level security;

create policy "Staff can view liability requests" on public.stock_count_liability_requests
  for select using (fn_is_any_staff());
create policy "Staff can insert liability requests" on public.stock_count_liability_requests
  for insert with check (fn_is_any_staff());

create policy "Staff can view liability shares" on public.stock_count_liability_shares
  for select using (fn_is_any_staff());
create policy "Staff can insert liability shares" on public.stock_count_liability_shares
  for insert with check (fn_is_any_staff());
-- Update (confirm/decline) sirf service-role se, server action ke
-- andar -- pehle tasdeeq hoti hai ke banda khud usi share ka malik hai
-- ya Owner/Admin hai, phir hi update hota hai. Yahan koi authenticated
-- update policy jaan boojh kar nahi -- warna koi bhi staff kisi
-- doosre ka share seedha "confirmed" likh sakta.

grant select, insert on public.stock_count_liability_requests to authenticated;
grant select, insert on public.stock_count_liability_shares to authenticated;

comment on table public.stock_count_liability_requests is
  'Stock count ka shortage (kami) jab Sale Staff ke khate mein bhejne ka faisla ho -- 421.';
comment on table public.stock_count_liability_shares is
  'Har zimmedar staff ka apna hissa -- alag alag confirm/decline hota hai -- 421.';
