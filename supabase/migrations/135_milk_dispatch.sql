-- =====================================================================
-- AgriBridge — Migration 135: Doodh ki rawangi (Dispatch)
-- =====================================================================
-- Doodh ka safar teen qadam ka hai:
--
--   kisan  ->  gaari  ->  chiller  ->  COMPANY
--
-- Pehle do qadam pehle se darj hote the (milk_route_collections): gaari
-- ne khet se kitna uthaya aur chiller par kitna pahuncha, aur farq
-- kitna. Teesra qadam KAHIN DARJ NAHI HOTA THA.
--
-- Aur wohi qadam sab se ahem hai. Al Rana doodh bechta nahi -- jama
-- karta hai aur company ko deta hai, FI LITRE service rate par
-- (company_billing_settings). Yani kamai us adad par hai jo COMPANY ne
-- mana ke usay mila.
--
-- Chiller kahe 1,000 litre gaye aur company kahe 950 aaye, to wo 50
-- litre seedha hamare nafe se jate hain -- aur is se pehle wo farq kahin
-- likha hi nahi jata tha. Mahine ke bill par sirf company ka adad aata
-- tha aur us se sawal karne ke liye koi apna record nahi hota tha.
--
-- ---------------------------------------------------------------------
-- Kami ka paimana wohi jo route par hai
-- ---------------------------------------------------------------------
-- Naya paimana banane ka matlab hota: ek hi karobar mein doodh ki kami
-- ke do alag qanoon. Is liye hadd wahi se aati hai
-- (milk_rate_settings.shortage_alert_threshold) jo gaari wali kami par
-- lagti hai.
--
-- Kami ka hisaab database khud karta hai, form se nahi aata -- wohi
-- wajah jo har jagah hai: do adad bhej kar teesra bhi bhejna us din
-- ghalat ho jata hai jis din koi ek badal kar doosra badalna bhool jaye.
-- =====================================================================

create table if not exists milk_dispatches (
  id uuid primary key default uuid_generate_v4(),
  dispatch_date date not null default current_date,
  shift text not null default 'morning',
  branch_id uuid references branches(id),

  vehicle_name text,
  driver_name text,

  -- Chiller se kitna nikla
  dispatched_liters numeric(14,3) not null check (dispatched_liters > 0),
  fat_percentage numeric(5,2),
  snf_percentage numeric(5,2),

  -- Company ne kitna mana. Khali reh sakta hai: gaari nikal chuki hai
  -- magar company ki raseed abhi nahi aayi -- aur wo darmiyani halat bhi
  -- ek sach hai jise chhupana nahi chahiye.
  received_liters numeric(14,3),
  received_at timestamptz,
  received_by uuid references profiles(id),

  shortage_liters numeric(14,3)
    generated always as (case when received_liters is null then null
                              else dispatched_liters - received_liters end) stored,
  shortage_percentage numeric(8,3)
    generated always as (case when received_liters is null or dispatched_liters = 0 then null
                              else round(((dispatched_liters - received_liters) / dispatched_liters) * 100, 3) end) stored,

  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),

  constraint milk_dispatch_shift check (shift in ('morning', 'evening')),
  constraint milk_dispatch_received check (received_liters is null or received_liters >= 0),
  -- Raseed aayi hai to us ka waqt bhi hona chahiye. Bina waqt ke adad ye
  -- sawal kabhi jawab nahi de pata ke wo kab aur kis ke kehne par likha
  -- gaya.
  constraint milk_dispatch_received_at check (received_liters is null or received_at is not null)
);

create index if not exists idx_milk_dispatch_date on milk_dispatches (dispatch_date desc, shift);
create index if not exists idx_milk_dispatch_branch on milk_dispatches (branch_id, dispatch_date desc);

-- Ek chiller, ek din, ek shift -- ek hi rawangi.
create unique index if not exists milk_dispatch_one_per_shift
  on milk_dispatches (branch_id, dispatch_date, shift);

alter table milk_dispatches enable row level security;

drop policy if exists milk_dispatch_all on milk_dispatches;
create policy milk_dispatch_all on milk_dispatches for all to authenticated
  using (fn_is_any_staff()) with check (fn_is_any_staff());

comment on table milk_dispatches is
  'Chiller se company tak doodh ki rawangi. Kitna gaya, company ne kitna mana, aur farq kitna (135).';

-- ---------------------------------------------------------------------
-- Nigrani -- wo rawangiyan jin par sawal banta hai
-- ---------------------------------------------------------------------
-- Do alag baatein, aur dono ka alag hona zaroori hai:
--
--   raseed_ka_intezar   gaari gaye do din ho gaye aur company ka jawab
--                       nahi aaya. Ye bhoolne wali cheez hai, chori nahi.
--   kami_zyada          company ne hadd se zyada kam mana. Ye sawal ki
--                       cheez hai.
create or replace view v_milk_dispatch_watch as
select
  d.id,
  d.dispatch_date,
  d.shift,
  b.name as chiller,
  d.dispatched_liters,
  d.received_liters,
  d.shortage_liters,
  d.shortage_percentage,
  case
    when d.received_liters is null then 'raseed_ka_intezar'
    else 'kami_zyada'
  end as issue
from milk_dispatches d
left join branches b on b.id = d.branch_id
cross join (select coalesce(shortage_alert_threshold, 0.5) as t from milk_rate_settings limit 1) s
where
  (d.received_liters is null and d.dispatch_date < current_date - 1)
  or (d.received_liters is not null and d.shortage_percentage > s.t);

comment on view v_milk_dispatch_watch is
  'Khali honi chahiye. Ya to company ki raseed do din se nahi aayi, ya kami hadd se zyada hai.';

-- ---------------------------------------------------------------------
-- Menu mein
-- ---------------------------------------------------------------------
insert into features (key, label, route, icon, label_en, label_ur)
values ('milk-collection.dispatch', 'Doodh ki Rawangi', '/admin/milk-collection/dispatch', 'Truck',
        'Milk Dispatch', 'دودھ کی روانگی')
on conflict (key) do update set label = excluded.label, route = excluded.route,
  icon = excluded.icon, label_en = excluded.label_en, label_ur = excluded.label_ur;

insert into dashboard_features (dashboard_key, feature_key, sort_order)
values ('milk', 'milk-collection.dispatch', 25) on conflict do nothing;
