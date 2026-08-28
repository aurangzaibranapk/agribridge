-- =====================================================================
-- Migration 104: Feature aur Dashboard ka dhaancha
-- =====================================================================
-- Ab tak menu code mein likha hua tha (nav-items.ts) aur ijazat safhe ke
-- raaste (route) par lagti thi. Do kharabiyan is se paida hoti hain:
--
-- 1) Ek hi cheez kai jagah likhi jati hai. "AgriBridge Ordering" abhi
--    Sales, Purchases, Inventory aur Finance -- chaar jagah likha hai.
--    Kal us ka naam ya raasta badla to chaar jagah badalna parega, aur
--    ek jagah reh jane ka matlab hai ke kisi department ka menu toot
--    gaya.
--
-- 2) Kuch bhi badalne ke liye code badalna parta hai. "Fuel Tracker
--    Milk Dashboard ko bhi de do" jaisi mamooli baat ke liye build aur
--    deploy ka poora chakkar chalta hai.
--
-- Ab har kaam ek FEATURE hai -- ek jagah, ek naam, ek raasta. Dashboard
-- alag cheez hai, aur beech mein assignment ki table hai. Ek feature kai
-- dashboard par nazar aa sakta hai, magar rehta ek hi jagah hai: na naql
-- banti hai, na do jagah ka data alag hota hai.
--
-- Ijazat ab teen hisson mein hai, jaan boojh kar:
--     feature      -- kaam kaunsa
--     actions      -- us par kya kar sakta hai (dekhna? banana? approve?)
--     data_scope   -- kis ka data (sab? apni branch? apni shop?)
-- Pehle sirf pehla hissa tha: safha khulta tha ya nahi. Us se ye kehna
-- mumkin hi nahi tha ke "Milk Manager cash book dekh sakta hai magar
-- entry nahi kar sakta, aur sirf doodh wali entries dekh sakta hai".

-- ---------------------------------------------------------------
-- 1) Dashboards -- kaam ke bare khane
-- ---------------------------------------------------------------
create table if not exists dashboards (
  key text primary key,
  label text not null,
  icon text,
  summary text,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 2) Features -- har kaam ek dafa, ek jagah
-- ---------------------------------------------------------------
create table if not exists features (
  key text primary key,
  label text not null,
  route text not null,
  icon text,
  -- Wo kaam jo paise ya ijazat ko haath lagate hain. In par ijazat
  -- alag se, soch samajh kar di jati hai.
  is_sensitive boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_features_route on features(route);

-- ---------------------------------------------------------------
-- 3) Kaun sa feature kis dashboard par -- yahi wo jagah hai jise
--    Master Admin badalta hai, code ko haath lagaye baghair.
-- ---------------------------------------------------------------
create table if not exists dashboard_features (
  dashboard_key text not null references dashboards(key) on delete cascade,
  feature_key text not null references features(key) on delete cascade,
  sort_order int not null default 100,
  primary key (dashboard_key, feature_key)
);

create index if not exists idx_dashboard_features_feature on dashboard_features(feature_key);

-- ---------------------------------------------------------------
-- 4) Departments -- ab database mein, code mein nahi
-- ---------------------------------------------------------------
create table if not exists departments (
  key text primary key,
  label text not null,
  role text not null,
  dashboard_key text references dashboards(key),
  summary text,
  head_profile_id uuid references profiles(id),
  sort_order int not null default 100,
  is_active boolean not null default true
);

create unique index if not exists idx_departments_role on departments(role);

-- ---------------------------------------------------------------
-- 5) Ijazat -- role par
-- ---------------------------------------------------------------
-- actions: view / create / edit / verify / approve / reject / export / assign
-- data_scope: all / own_branch / own_shop / own_records
create table if not exists role_feature_permissions (
  role text not null,
  feature_key text not null references features(key) on delete cascade,
  actions text[] not null default array['view']::text[],
  data_scope text not null default 'own_branch',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (role, feature_key)
);

alter table role_feature_permissions drop constraint if exists chk_role_feature_scope;
alter table role_feature_permissions add constraint chk_role_feature_scope
  check (data_scope in ('all', 'own_branch', 'own_shop', 'own_records'));

-- ---------------------------------------------------------------
-- 6) Ijazat -- kisi ek banday par (aur waqti ijazat)
-- ---------------------------------------------------------------
-- expires_at bhara ho to ijazat us waqt ke baad khud khatam. Chhutti par
-- gaye manager ki jagah kisi ko dena aam baat hai; asal masla wapas
-- lena hota hai -- wo hamesha yaad nahi rehta. Is liye waqt yahin darj
-- hota hai, kisi ke yaad rakhne par nahi chhora jata.
create table if not exists user_feature_permissions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  feature_key text not null references features(key) on delete cascade,
  actions text[] not null default array['view']::text[],
  data_scope text not null default 'own_branch',
  starts_at timestamptz,
  expires_at timestamptz,
  reason text,
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_feature_profile on user_feature_permissions(profile_id);
create index if not exists idx_user_feature_expiry on user_feature_permissions(expires_at);

alter table user_feature_permissions drop constraint if exists chk_user_feature_scope;
alter table user_feature_permissions add constraint chk_user_feature_scope
  check (data_scope in ('all', 'own_branch', 'own_shop', 'own_records'));

-- Waqti ijazat ka waqt ulta na ho.
alter table user_feature_permissions drop constraint if exists chk_user_feature_window;
alter table user_feature_permissions add constraint chk_user_feature_window
  check (starts_at is null or expires_at is null or expires_at > starts_at);

-- ---------------------------------------------------------------
-- 7) Department Head ki hadd
-- ---------------------------------------------------------------
-- ===== HARD RULE (code mein lagti hai, yahan us ki bunyad hai) =====
-- Head apni team ko sirf wahi ijazat de sakta hai jo Master Admin ne
-- USE di ho. Is ke baghair delegation ek chor darwaza ban jata hai:
-- head khud ko ya kisi aur ko wo ikhtiyar de deta jo us ke paas tha hi
-- nahi.
create table if not exists department_head_grants (
  department_key text not null references departments(key) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  max_actions text[] not null default array['view']::text[],
  max_data_scope text not null default 'own_branch',
  granted_by uuid references profiles(id),
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (department_key, profile_id)
);

alter table department_head_grants drop constraint if exists chk_head_scope;
alter table department_head_grants add constraint chk_head_scope
  check (max_data_scope in ('all', 'own_branch', 'own_shop', 'own_records'));

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
-- Parhna har staff ke liye khula hai -- menu isi se banta hai. Badalna
-- sirf admin darje ke liye.
do $$
declare t text;
begin
  foreach t in array array[
    'dashboards','features','dashboard_features','departments',
    'role_feature_permissions','user_feature_permissions','department_head_grants'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists staff_read_%s on %I', t, t);
    execute format(
      'create policy staff_read_%s on %I for select using (public.fn_is_any_staff())', t, t);
    execute format('drop policy if exists admin_write_%s on %I', t, t);
    execute format(
      'create policy admin_write_%s on %I for all using (public.fn_is_admin_level()) with check (public.fn_is_admin_level())',
      t, t);
  end loop;
end $$;

-- =====================================================================
-- Seed
-- =====================================================================
-- Ye seed live database par chala diya gaya hai. Yahan record ke liye
-- rakha hai, taake koi naya environment banane par wahi dhaancha bane.
--
-- Poora seed generate hua hai maujooda nav-items.ts se: 14 dashboard,
-- 114 feature, 153 assignment. Feature ka key us ke raaste se banta hai
-- (/admin/milk-collection/collect -> milk-collection.collect), is liye
-- naya safha banate waqt naam khud tay ho jata hai.
--
-- Purani (safhe wali) ijazat se feature wali ijazat khud ban gayi, taake
-- kisi banday ki ijazat is tabdeeli mein kho na jaye:
--
--   insert into role_feature_permissions (role, feature_key, actions, data_scope)
--   select rpp.role, f.key,
--          case when f.is_sensitive then array['view'] else array['view','create','edit'] end,
--          'own_branch'
--   from role_page_permissions rpp
--   cross join lateral unnest(rpp.allowed_pages) as page
--   join features f on f.route = page
--   on conflict do nothing;
--
-- Hassas feature (paise ya ijazat ko haath lagane wale) par sirf 'view'
-- rakha gaya, jaan boojh kar. Un par banane/badalne ki ijazat soch samajh
-- kar, ek ek kar ke di jani chahiye -- ek hi migration mein sab ko de
-- dena wahi purani ghalti hoti jo ye poora dhaancha door karne aaya hai.

insert into features (key, label, route, icon, is_sensitive) values
('dashboard-manager', 'Dashboard & Feature Manager', '/admin/dashboard-manager', 'LayoutGrid', true)
on conflict (key) do update set label = excluded.label, is_sensitive = excluded.is_sensitive;

insert into dashboard_features (dashboard_key, feature_key, sort_order)
values ('admin', 'dashboard-manager', 5)
on conflict do nothing;

-- =====================================================================
-- Ijazat ka ek hi zariya (menu aur rok, dono is se parhte hain)
-- =====================================================================
-- Teen jagah se ijazat aati hai: role ki, banday ke apne naam par di
-- hui, aur waqti. Teenon ko har baar alag alag jorna do jagah likhne ka
-- kaam banta -- aur do jagah ka hisaab ek din alag ho hi jata hai.
-- Waqti ijazat ka waqt bhi yahin dekha jata hai, taake koi purani
-- ijazat is liye chalti na rahe ke wapas lena kisi ko yaad nahi raha.
create or replace view v_user_feature_access
with (security_invoker = true) as
select
  p.id            as profile_id,
  f.key           as feature_key,
  f.route         as route,
  rfp.actions     as actions,
  rfp.data_scope  as data_scope,
  false           as is_temporary,
  null::timestamptz as expires_at
from profiles p
join role_feature_permissions rfp on rfp.role = p.role::text
join features f on f.key = rfp.feature_key and f.is_active
where p.is_active

union all

select
  ufp.profile_id, f.key, f.route, ufp.actions, ufp.data_scope,
  ufp.expires_at is not null, ufp.expires_at
from user_feature_permissions ufp
join features f on f.key = ufp.feature_key and f.is_active
where (ufp.starts_at is null or ufp.starts_at <= now())
  and (ufp.expires_at is null or ufp.expires_at > now());
