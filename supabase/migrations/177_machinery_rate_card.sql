-- 177: Rate card -- fasal aur machine ke hisaab se default rate
--
-- Ab tak har booking par rate poora naye sire se likha jata tha. Pichli
-- booking se andaza aa jata tha, magar wo PICHLI booking ka rate hota
-- tha -- kisi doosri fasal ka, kisi doosri machine ka. Jo banda naya
-- tha use pata hi nahi hota tha ke gandum ki kattai ka aaj ka rate kya
-- hai, aur wo poochh kar likhta tha.
--
-- YE SIRF DEFAULT HAI. Ye kisi hisaab ka malik NAHI hai.
--
--   Booking par rate ka malik wohi hai jo pehle tha: ek qism ho to
--   final_rate, dono qism hon to sabit_rate aur kutra_rate (176). Rate
--   card sirf pehli dafa khana bhar deta hai -- us ke baad staff jo
--   marzi likhe, upar ya neeche.
--
--   Bill banate waqt rate card ko dekha hi nahi jata. Ye jaan boojh kar
--   hai: agar bill card se rate uthata to card badalne par purane bill
--   ka hisaab bhi badal jata -- aur wo bill kisan ko de bhi diya gaya
--   hota.
--
-- Rate badalne par purani qatar mitai nahi jati. Nayi qatar nayi
-- tareekh se lagti hai aur purani wahin rehti hai: "us waqt rate kya
-- tha" ka jawab kisi din zaroor poochha jata hai.

create table if not exists public.machinery_rate_cards (
  id             uuid primary key default gen_random_uuid(),
  -- Khali = har fasal / har machine. Khaas qatar aam qatar ko harati hai.
  crop_key       text references public.crops(key),
  machine_type   text,
  harvest_type   text not null,
  rate           numeric(12,2) not null,
  effective_from date not null default current_date,
  is_active      boolean not null default true,
  notes          text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint chk_rate_card_type check (harvest_type in ('sabit', 'kutra')),
  constraint chk_rate_card_rate check (rate > 0)
);

comment on table public.machinery_rate_cards is
  'Default rate -- sirf khana bharne ke liye. Kisi bill ka malik nahi; bill hamesha booking par tay hue rate se banta hai.';
comment on column public.machinery_rate_cards.crop_key is
  'Khali = har fasal. Khaas fasal ki qatar aam qatar ko harati hai.';
comment on column public.machinery_rate_cards.effective_from is
  'Is tareekh se laagu. Purani qatar mitai nahi jati -- "us waqt rate kya tha" ka jawab bhi chahiye hota hai.';

-- Ek hi din, ek hi fasal-machine-qism par do rate nahi ho sakte.
create unique index if not exists uq_machinery_rate_card
  on public.machinery_rate_cards
  (coalesce(crop_key, ''), coalesce(machine_type, ''), harvest_type, effective_from);

create index if not exists idx_machinery_rate_card_lookup
  on public.machinery_rate_cards (harvest_type, is_active, effective_from desc);

alter table public.machinery_rate_cards enable row level security;

-- Padhna har staff ke liye: rate booking banate waqt saamne aana chahiye.
drop policy if exists rate_cards_read on public.machinery_rate_cards;
create policy rate_cards_read on public.machinery_rate_cards
  for select using (fn_is_any_staff());

-- Likhna sirf admin darje ka kaam hai -- rate karobar ka faisla hai,
-- roz ka indraj nahi.
drop policy if exists rate_cards_write on public.machinery_rate_cards;
create policy rate_cards_write on public.machinery_rate_cards
  for insert with check (fn_is_admin_level());

drop policy if exists rate_cards_update on public.machinery_rate_cards;
create policy rate_cards_update on public.machinery_rate_cards
  for update using (fn_is_admin_level()) with check (fn_is_admin_level());

grant select on public.machinery_rate_cards to authenticated;
grant insert, update on public.machinery_rate_cards to authenticated;

-- Safha aur menu.
insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, is_active) values
  ('machinery-rental.rate-card', 'Rate Card', 'Rate Card', 'ریٹ کارڈ',
   '/admin/machinery-rental/rate-card', 'Tags', false, true)
on conflict (key) do update set route = excluded.route, icon = excluded.icon, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order) values
  ('machinery', 'machinery-rental.rate-card', 30, 'Bookings', 2)
on conflict (dashboard_key, feature_key) do update
  set section = excluded.section, section_order = excluded.section_order, sort_order = excluded.sort_order;
