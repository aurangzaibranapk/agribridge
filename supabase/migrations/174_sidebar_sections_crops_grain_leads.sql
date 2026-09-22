-- 174: Menu ki nayi tarteeb, fasl ka master, aur machinery se grain lead
--
-- Teen alag cheezen, magar teenon ek hi shikayat se aayi hain: "safhe to
-- ban gaye, magar milte nahi".
--
--   1. Machinery ke ab 18 safhe hain. Ek hi lambi fehrist mein wo
--      dhoondhe nahi jate. Group ke andar chhoti sarkhiyan (section)
--      daal di hain -- koi safha hataya nahi, sirf tarteeb badli hai.
--   2. Fasl (crop) har form mein alag hard-coded fehrist thi. Ab ek
--      table hai, jis mein staff naya naam khud daal sakta hai.
--   3. Jis kisan ne kattai ke waqt kaha "fasal aap ko bechunga", wo
--      grain walon tak pahunchna chahiye. Wo SAUDA nahi -- sirf
--      dilchaspi. Is liye ye view hai, koi nayi entry nahi.

-- ---------------------------------------------------------------- 1
-- Menu ke group ke andar chhoti sarkhiyan.

alter table public.dashboard_features
  add column if not exists section text,
  add column if not exists section_order int not null default 0;

comment on column public.dashboard_features.section is
  'Group ke andar chhoti sarkhi. Khali ho to item sidha group ke neeche aata hai.';

update public.dashboard_features set section = 'Overview', section_order = 1
 where dashboard_key = 'machinery' and feature_key in ('machinery-rental', 'machinery-rental.dashboard');

update public.dashboard_features set section = 'Bookings', section_order = 2
 where dashboard_key = 'machinery' and feature_key in ('machinery-rental.list', 'machinery-rental.assign');

update public.dashboard_features set section = 'Operations', section_order = 3
 where dashboard_key = 'machinery' and feature_key in ('machinery-rental.schedule', 'machinery-rental.work', 'machinery-rental.farm-map', 'machinery-rental.work-claims');

update public.dashboard_features set section = 'Assets aur Vendors', section_order = 4
 where dashboard_key = 'machinery' and feature_key in ('machinery-rental.machines', 'machinery-rental.vendor-settlement');

update public.dashboard_features set section = 'Diesel aur Kharcha', section_order = 5
 where dashboard_key = 'machinery' and feature_key in ('machinery-rental.diesel');

update public.dashboard_features set section = 'Hisaab', section_order = 6
 where dashboard_key = 'machinery' and feature_key in ('machinery-rental.billing', 'machinery-rental.advance-claims', 'machinery-rental.vendor-cash', 'machinery-rental.reminders');

update public.dashboard_features set section = 'Reports', section_order = 7
 where dashboard_key = 'machinery' and feature_key in ('machinery-rental.pnl', 'machinery-rental.reports');

-- ---------------------------------------------------------------- 2
-- Fasl ka master.
--
-- Pehle har form mein apni fehrist thi. Nayi fasl aane par teen jagah
-- code badalna parta tha -- aur ek jagah reh jati thi.

create table if not exists public.crops (
  key         text primary key,
  label       text not null,
  label_en    text,
  label_ur    text,
  is_active   boolean not null default true,
  sort_order  int not null default 100,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id)
);

comment on table public.crops is
  'Fasl ke naam -- ek hi jagah. Form yahin se fehrist uthate hain.';

alter table public.crops enable row level security;

drop policy if exists crops_read on public.crops;
create policy crops_read on public.crops for select using (true);

drop policy if exists crops_insert on public.crops;
create policy crops_insert on public.crops for insert with check (fn_is_any_staff());

drop policy if exists crops_update on public.crops;
create policy crops_update on public.crops for update using (fn_is_any_staff()) with check (fn_is_any_staff());

grant select on public.crops to anon, authenticated;
grant insert, update on public.crops to authenticated;

insert into public.crops (key, label, label_en, label_ur, sort_order) values
  ('wheat',      'Gandum',   'Wheat',      'گندم',    1),
  ('rice',       'Chawal',   'Rice',       'چاول',    2),
  ('maize',      'Makai',    'Maize',      'مکئی',    3),
  ('cotton',     'Kapas',    'Cotton',     'کپاس',    4),
  ('sugarcane',  'Ganna',    'Sugarcane',  'گنا',     5),
  ('vegetables', 'Sabziyan', 'Vegetables', 'سبزیاں',  6)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- 3
-- Machinery se grain ki lead.
--
-- Ye SAUDA nahi -- sirf dilchaspi. Kisan ne kattai ke waqt kaha ke fasal
-- hamein bechega. Us ko sauda bana kar likh dena jhoot hoga: na rate tay
-- hua, na wazan hua. Is liye ye sirf ek view hai -- grain wala khud
-- baat kar ke asal sauda apni jagah likhega.

create or replace view public.v_grain_leads_from_machinery as
select
  b.id                                  as booking_id,
  b.booking_number,
  b.booking_date,
  f.id                                  as farmer_id,
  f.full_name                           as farmer_name,
  f.farmer_code,
  f.phone_number                        as farmer_phone,
  coalesce(b.village, f.village)        as village,
  b.crop_type,
  b.harvest_area,
  b.preferred_date                      as kattai_ki_tareekh,
  coalesce(w.kiya, 0)                   as kaam_ho_chuka,
  coalesce(w.poora, false)              as kattai_mukammal,
  b.status                              as booking_status
from public.machinery_bookings b
left join public.farmers f on f.id = b.farmer_id
left join lateral (
  select sum(w2.actual_area) as kiya, bool_or(w2.is_final) as poora
    from public.machinery_work_records w2
   where w2.booking_id = b.id and w2.verification_status = 'verified'
) w on true
where b.will_sell_to_us is true
  and b.status <> 'cancelled'
  and fn_is_any_staff();

comment on view public.v_grain_leads_from_machinery is
  'Jin kisanon ne kaha "fasal aap ko bechunga". Ye SAUDA nahi -- sirf dilchaspi. Sauda banana jhoot hoga.';

grant select on public.v_grain_leads_from_machinery to authenticated;

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('grain.machinery-leads', 'Machinery se Grain Leads', 'Grain Leads from Machinery', 'مشینری سے گرین لیڈز', '/admin/grain/leads', 'Sprout', false, true)
on conflict (key) do update set route = excluded.route, icon = excluded.icon, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order) values
  ('grain', 'grain.machinery-leads', 20, 'Leads', 5)
on conflict (dashboard_key, feature_key) do update set section = excluded.section, section_order = excluded.section_order;
