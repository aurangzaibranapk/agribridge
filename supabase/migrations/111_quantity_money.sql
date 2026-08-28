-- =====================================================================
-- Migration 111: Miqdar aur paise ka milaan
-- =====================================================================
-- Step 1 se 5 tak paise ka pehlu mukammal ho gaya: har rupya darj hota
-- hai, dono taraf barabar hoti hai, aur raat ko cash aur maal gin kar
-- milaya jata hai.
--
-- Magar paise ka hisaab andar se bilkul theek ho sakta hai aur phir bhi
-- ghalat ho -- kyunki wo sirf ye darj karta hai jo kisi ne KAHA ke hua.
-- Miqdar us hi waqie ka DOOSRA gawah hai, aur wo pehle se azad hai:
--
--     Rs 72,500 kisan ko diye -- ye paise ka gawah hai.
--     500 litre uthaya, 480 chiller par pahuncha -- ye miqdar ka.
--
-- Dono theek theek darj hain, kitab barabar hai, aur phir bhi 20 litre
-- ke paise wo maal khareedne mein gaye jo kabhi mila hi nahi.
--
-- Aaj ye kami system mein MAUJOOD hai (milk_route_collections us ko
-- ginta hai) magar us ki QEEMAT kahin nahi jati. Wo doodh ki khareed ke
-- andar hi chhupi rehti hai, jahan wo aam lagat jaisi nazar aati hai.
-- Mahine ke aakhir mein fi litre kharcha thora zyada dikhta hai, aur
-- koi ye nahi poochh sakta ke kyun -- kyunki kami ka apna koi khana hi
-- nahi.
--
-- Ye migration us kami ko us ka apna khana deti hai. Raqam nayi nahi
-- banti (wo pehle hi kharch ho chuki hai); wo sirf "khareed" se nikal
-- kar "nuqsan" mein chali jati hai. Kul kharcha wahi rehta hai, magar
-- ab nuqsan alag nazar aata hai aur us par sawal ho sakta hai.

-- ---------------------------------------------------------------
-- 1) Milaan ka record
-- ---------------------------------------------------------------
create table if not exists quantity_reconciliations (
  id uuid primary key default uuid_generate_v4(),

  -- 'milk'  -- maidan se uthaya vs chiller par pahuncha
  -- 'grain' -- khareeda vs becha vs godam mein
  stream text not null,

  period_month int not null,
  period_year int not null,
  branch_id uuid references branches(id),

  qty_in numeric(14,3) not null,
  qty_out numeric(14,3) not null,
  qty_gap numeric(14,3) not null,
  unit text not null default 'L',

  -- Fi unit qeemat usi waqt ki, taake baad mein rate badalne se guzra
  -- hua nuqsan khud ba khud na badal jaye.
  unit_cost numeric(14,2) not null,
  gap_value numeric(14,2) not null,

  reason varchar(255) not null,
  journal_entry_id uuid references journal_entries(id),

  booked_by uuid not null references profiles(id),
  booked_at timestamptz not null default now()
);

alter table quantity_reconciliations drop constraint if exists chk_qr_stream;
alter table quantity_reconciliations add constraint chk_qr_stream
  check (stream in ('milk', 'grain'));

alter table quantity_reconciliations drop constraint if exists chk_qr_period;
alter table quantity_reconciliations add constraint chk_qr_period
  check (period_month between 1 and 12 and period_year between 2020 and 2100);

-- Farq wahi hoga jo asal mein hai -- apni marzi ka nahi.
alter table quantity_reconciliations drop constraint if exists chk_qr_gap;
alter table quantity_reconciliations add constraint chk_qr_gap
  check (qty_gap = qty_in - qty_out);

-- Wajah hamesha lazmi. Yahan farq "shayad" nahi hota -- wo ho chuka
-- hota hai, aur us par kuch na kuch samajh zaroor aayi hoti hai.
alter table quantity_reconciliations drop constraint if exists chk_qr_reason;
alter table quantity_reconciliations add constraint chk_qr_reason
  check (length(btrim(reason)) >= 5);

-- Ek mahina, ek stream, ek dafa. Dobara ho sake to wahi nuqsan do dafa
-- khate mein chala jayega -- aur kitab phir bhi barabar rahegi.
create unique index if not exists idx_qr_once
  on quantity_reconciliations(stream, period_year, period_month, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

create or replace function fn_no_qr_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Miqdar ka milaan badla ya mitaya nahi ja sakta. Ghalti ho to ledger mein reversal entry banayein.';
end;
$$;

drop trigger if exists trg_no_change_qr on quantity_reconciliations;
create trigger trg_no_change_qr
  before update or delete on quantity_reconciliations
  for each row execute function fn_no_qr_change();

-- ---------------------------------------------------------------
-- 2) RLS
-- ---------------------------------------------------------------
alter table quantity_reconciliations enable row level security;

drop policy if exists staff_read_qr on quantity_reconciliations;
create policy staff_read_qr on quantity_reconciliations for select using (fn_is_any_staff());
drop policy if exists staff_write_qr on quantity_reconciliations;
create policy staff_write_qr on quantity_reconciliations for insert with check (fn_is_any_staff());

-- ---------------------------------------------------------------
-- 3) Safha
-- ---------------------------------------------------------------
insert into features (key, label, route, icon, is_sensitive) values
('quantity-money', 'Miqdar aur Paisa', '/admin/quantity-money', 'Scale', true)
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_sensitive = excluded.is_sensitive;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
('master', 'quantity-money', 7),
('finance', 'quantity-money', 6)
on conflict do nothing;

insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('finance', 'quantity-money', array['view','create','export']::text[], 'all'),
('milk_collection', 'quantity-money', array['view']::text[], 'own_branch')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
