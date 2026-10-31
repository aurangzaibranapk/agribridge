-- =====================================================================
-- AgriBridge — Migration 732: Chiller ka din/shift ka total
-- =====================================================================
-- Kisan ki alag qatarein ab is hisaab ke liye zaroori nahi.
-- Staff us chiller par shift ka gross litre, FAT aur LR likhta hai.
-- SNF, TS aur Adjusted phone Milk TS% Volume ke digits hain
-- (Java DecimalFormat ceiling). Ye adad app likhti hai — numeric
-- formula dobara SQL mein nahi, warna TS 12.716 reh jata hai jab
-- phone 12.717 dikhata hai.
--
-- Aaya = in totals ka jama. Gaya = milk_dispatches (company / vendor /
-- party) ka gross. Farq = aaya − gaya. Total na ho to farq null.
--
-- Kisan ki adaigi (fn_apply_milk_fat, snf 0.805) yahan nahi badli.
-- =====================================================================

create table if not exists public.milk_chiller_totals (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  chiller_no text not null,
  entry_date date not null,
  shift text not null,
  gross_liters numeric(14,3) not null,
  fat_percentage numeric(6,3) not null,
  lr numeric(6,3) not null,
  snf_percentage numeric(6,3) not null,
  ts_percentage numeric(6,3) not null,
  adjusted_liters numeric(14,3) not null,
  snf_constant numeric(8,4) not null,
  reference_ts numeric(6,3) not null,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milk_chiller_totals_shift check (shift in ('morning', 'evening')),
  constraint milk_chiller_totals_no check (char_length(btrim(chiller_no)) between 1 and 40),
  constraint milk_chiller_totals_gross check (gross_liters > 0 and gross_liters <= 100000),
  constraint milk_chiller_totals_fat check (fat_percentage > 0 and fat_percentage <= 15),
  constraint milk_chiller_totals_lr check (lr > 0 and lr <= 40),
  constraint milk_chiller_totals_snf check (snf_percentage > 0 and snf_percentage <= 20),
  constraint milk_chiller_totals_ts check (ts_percentage > 0 and ts_percentage <= 30),
  constraint milk_chiller_totals_adj check (adjusted_liters >= 0 and adjusted_liters <= 100000),
  constraint milk_chiller_totals_ref check (reference_ts > 0)
);

create unique index if not exists milk_chiller_totals_one
  on public.milk_chiller_totals (branch_id, entry_date, shift);

comment on table public.milk_chiller_totals is
  'Chiller par shift ka kul doodh. Kisan ki line zaroori nahi. Lab phone digits (732).';

alter table public.milk_chiller_totals enable row level security;

drop policy if exists milk_chiller_totals_staff on public.milk_chiller_totals;
create policy milk_chiller_totals_staff on public.milk_chiller_totals
  for all to authenticated
  using (public.fn_is_any_staff())
  with check (public.fn_is_any_staff());

revoke all on public.milk_chiller_totals from public, anon, authenticated;
grant select, insert, update, delete on public.milk_chiller_totals to authenticated;

-- Manager aur doodh ka staff sirf apne chiller par. Owner/Admin sab par.
-- Service role (auth.uid khali) seedha SQL se likh sakta hai.
create or replace function public.fn_milk_chiller_total_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_home uuid;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role::text, is_active, branch_id
    into v_role, v_active, v_home
  from public.profiles
  where id = auth.uid();

  if v_active is distinct from true then
    raise exception 'Ye account fa''aal nahi hai.';
  end if;
  if v_role is null or v_role not in ('owner', 'super_admin', 'admin', 'manager', 'milk_collection') then
    raise exception 'Aapko is kaam ki ijazat nahi hai.';
  end if;
  if new.entry_date > (current_date + 1) or new.entry_date < date '2020-01-01' then
    raise exception 'Tareekh 2020 se kal tak ho sakti hai.';
  end if;
  if v_role in ('manager', 'milk_collection') and v_home is not null and new.branch_id is distinct from v_home then
    raise exception 'Doosre chiller par nahi likh sakte.';
  end if;
  return new;
end $$;

revoke all on function public.fn_milk_chiller_total_guard() from public, anon, authenticated;

drop trigger if exists milk_chiller_totals_guard on public.milk_chiller_totals;
create trigger milk_chiller_totals_guard
  before insert or update on public.milk_chiller_totals
  for each row execute function public.fn_milk_chiller_total_guard();

do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.milk_chiller_totals to service_role;
  end if;
end
$g$;

update public.features set
  label = 'Chiller — din ka doodh',
  label_en = 'Chiller — day total',
  description = 'Chiller par shift ka kul doodh: gross, FAT, LR. SNF, TS, Adjusted phone jaisa. Aaya, Company/Vendor/Party gaya, aur farq.',
  description_en = 'Shift total on the chiller: gross, FAT, LR. SNF, TS and adjusted match the phone. In, Company/Vendor/Party out, and the gap.',
  description_ur = 'چلر پر شفٹ کا کل دودھ۔ آیا، گیا، فرق۔'
where key = 'milk-collection.chiller';

update public.role_feature_permissions
set actions = array['view','create','edit','verify']::text[]
where feature_key = 'milk-collection.chiller'
  and role in ('manager', 'milk_collection');

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, related)
values
('milk-collection.chiller', 'rm',
 'Is chiller par is shift ka kul doodh. Gross litre, FAT aur LR. Kisan ki alag qatarein zaroori nahi.',
 'MCC / chiller ka staff aur manager. Apni branch.',
 'Har shift jab doodh chiller par aa jaye, kisan ki line se pehle.',
 array[
   'Chiller safha kholen. Chiller number branch se laga hota hai. Badalna ho to Chiller number badlein.',
   'Tareekh, shift (subah/shaam), gross litre, FAT aur LR likhein.',
   'SNF, TS aur Adjusted khud bharte hain — phone Milk TS% Volume jaisa. 1 litre, FAT 4.3, LR 27, standard 13 par SNF 8.416, TS 12.717, Adjusted 0.979. Temperature nahi, is liye LR correction nahi.',
   'Upar aaya (din ke totals ka jama), gaya Company / Vendor / Party, aur farq (aaya minus gaya). Jis manzil par slip nahi us par 0 L. Total darj na ho to farq nahi — sifar mat parhein.',
   'Phir Company, Vendor ya Party ki handover slip, ya roz ka hisaab.'
 ],
 'Total mahfooz karein. Phir usi din ki Company, Vendor ya Party slip. Roz ka hisaab yahi aaya dikhata hai.',
 array[
   'Kisan ki har line likhe baghair total ko adhura samajhna. Total hi aaya hai.',
   'Farq ko sifar parhna jab total darj hi na ho.',
   'SNF khud se do decimal (8.42) likhna. Phone teen decimal dikhata hai (8.416).',
   'Gaya ko kisan ki line samajhna. Gaya handover slip hai: Company, Vendor, Party.'
 ],
 array['milk-collection.handover','milk-collection.dispatch','milk-collection.collect']::text[]),
('milk-collection.chiller', 'en',
 'The shift total on this chiller: gross litres, FAT and LR. Farmer-by-farmer lines are not required.',
 'MCC / chiller staff and the manager, for their own branch.',
 'Each shift when milk is on the chiller, before any farmer line.',
 array[
   'Open the chiller page. The chiller number comes from the branch. Use Edit chiller number only to change it.',
   'Enter date, shift, gross litres, FAT and LR.',
   'SNF, TS and Adjusted fill in to match the phone Milk TS% Volume digits. 1 L, FAT 4.3, LR 27, standard 13 is SNF 8.416, TS 12.717, Adjusted 0.979. There is no temperature, so LR is not corrected.',
   'The summary is in (day totals), out to Company / Vendor / Party, and the gap (in minus out). A destination with no slip is 0 L. No total means no gap — do not read that as zero.',
   'Then open the Company, Vendor or Party handover slip, or the daily hisaab.'
 ],
 'Save the total. Then the Company, Vendor or Party slip for that day. The daily hisaab uses this as in.',
 array[
   'Thinking the total is incomplete without farmer lines. The total is the intake.',
   'Reading a missing total as zero variance.',
   'Typing SNF at two decimals. The phone shows three (8.416).',
   'Treating out as farmer lines. Out is the handover slip: Company, Vendor, Party.'
 ],
 array['milk-collection.handover','milk-collection.dispatch','milk-collection.collect']::text[]),
('milk-collection.chiller', 'ur',
 'اس چلر پر اس شفٹ کا کل دودھ۔ گراس، فیٹ، ایل آر۔ کسان کی الگ قطاریں ضروری نہیں۔',
 'چلر کا عملہ اور مینیجر، اپنی شاخ۔',
 'ہر شفٹ جب دودھ چلر پر آئے۔',
 array[
   'چلر صفحہ کھولیں۔ نمبر شاخ سے لگا ہے۔ بدلنے کے لیے چلر نمبر بدلیں۔',
   'تاریخ، شفٹ، گراس لیٹر، فیٹ اور ایل آر لکھیں۔',
   'ایس این ایف، ٹی ایس اور ایڈجسٹڈ فون جیسے خود آتے ہیں۔',
   'آیا، گیا (کمپنی، وینڈر، پارٹی) اور فرق۔ ٹوٹل نہ ہو تو فرق صفر نہیں۔',
   'پھر حوالگی سلپ یا روز کا حساب۔'
 ],
 'کل محفوظ کریں۔ پھر سلپ۔',
 array[
   'کسان کی لائن کے بغیر کل کو ادھورا سمجھنا۔',
   'غیر درج کل کو صفر فرق پڑھنا۔'
 ],
 array['milk-collection.handover','milk-collection.dispatch']::text[])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  related = excluded.related,
  updated_at = now();
