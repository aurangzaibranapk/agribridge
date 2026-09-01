-- =====================================================================
-- Migration 105: Motorcycle ki maintenance -- do qadam ki manzoori
-- =====================================================================
-- Motorcycle ki marammat aur oil ka kharcha DOODH ke khate mein jata
-- hai. Is liye us par do alag log faisla karte hain, aur tarteeb ahem
-- hai:
--
--   1) BRANCH MANAGER  -- wo maidan mein hai. Us ne dekha ke gaari
--      waqai workshop gayi, kaam waqai hua, aur bill waqai us kaam ka
--      hai. Ye baat sirf wohi jaanta hai jo mauqe par tha.
--
--   2) MILK MANAGER    -- kharcha us ke khate mein girta hai, is liye
--      aakhri faisla us ka. Wo dekhta hai ke kya ye kharcha doodh ke
--      hisaab mein jana chahiye, aur kya ye is waqt maqool hai.
--
-- Ek hi shakhs se dono kaam karwana ya do mein se ek hata dena aasan
-- tha, magar phir wo hota jo hamesha hota hai: bill dekhe baghair
-- manzoor ho jate hain, aur mahine ke aakhir mein fi litre kharcha
-- barha hua nazar aata hai bagair kisi wajah ke.
--
-- Dono qadam par comment LAZMI hai, aur ye rok database mein hai --
-- taake koi bhi raasta (naya code, seedhi SQL, koi aur tool) ise
-- bypass na kar sake.
--
-- Pehla qadam chhorna mumkin nahi: 'approved' tabhi ho sakta hai jab
-- branch manager pehle dekh chuka ho.

alter table maintenance_logs
  add column if not exists maintenance_type text not null default 'other',
  add column if not exists status text not null default 'pending',
  add column if not exists branch_verified_by uuid references profiles(id),
  add column if not exists branch_verified_at timestamptz,
  add column if not exists branch_comment varchar(255),
  add column if not exists approved_by uuid references profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists approve_comment varchar(255),
  add column if not exists rejection_reason varchar(255),
  add column if not exists bill_image_url text;

comment on column maintenance_logs.status is
  'pending -> branch_verified (branch manager ne dekha) -> approved (milk manager ne manzoor kiya). Kharcha sirf approved halat mein doodh ke khate mein ginta hai.';

alter table maintenance_logs drop constraint if exists chk_maintenance_type;
alter table maintenance_logs add constraint chk_maintenance_type
  check (maintenance_type in ('oil_change','service','repair','tyre','battery','other'));

alter table maintenance_logs drop constraint if exists chk_maintenance_status;
alter table maintenance_logs add constraint chk_maintenance_status
  check (status in ('pending','branch_verified','approved','rejected'));

-- ===== HARD RULE 1 =====
-- Pehla qadam chhora nahi ja sakta.
alter table maintenance_logs drop constraint if exists chk_maintenance_branch_step;
alter table maintenance_logs add constraint chk_maintenance_branch_step check (
  status not in ('branch_verified','approved')
  or (branch_verified_by is not null
      and branch_comment is not null
      and length(btrim(branch_comment)) >= 5)
);

-- ===== HARD RULE 2 =====
-- Aakhri manzoori bagair wajah likhe nahi hoti.
alter table maintenance_logs drop constraint if exists chk_maintenance_final_step;
alter table maintenance_logs add constraint chk_maintenance_final_step check (
  status <> 'approved'
  or (approved_by is not null
      and approve_comment is not null
      and length(btrim(approve_comment)) >= 5)
);

alter table maintenance_logs drop constraint if exists chk_maintenance_reject_reason;
alter table maintenance_logs add constraint chk_maintenance_reject_reason check (
  status <> 'rejected'
  or (rejection_reason is not null and length(btrim(rejection_reason)) >= 5)
);

create index if not exists idx_maintenance_status on maintenance_logs(status);
create index if not exists idx_maintenance_vehicle on maintenance_logs(vehicle_id);
create index if not exists idx_maintenance_date on maintenance_logs(service_date desc);

-- vehicles.service_interval_km ka default pehle se 1000 hai -- yani har
-- 1000 km par oil ki yaad dihani. Ise gaari ke hisab se badla ja sakta
-- hai.

-- =====================================================================
-- Feature aur ijazat
-- =====================================================================
insert into features (key, label, route, icon, is_sensitive) values
('milk-collection.cost-per-liter', 'Fi Litre Kharcha', '/admin/milk-collection/cost-per-liter', 'Calculator', false)
on conflict (key) do update set label = excluded.label;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
('milk', 'milk-collection.cost-per-liter', 60),
('finance', 'milk-collection.cost-per-liter', 60),
('master', 'milk-collection.cost-per-liter', 60),
('master', 'milk-collection.maintenance', 70)
on conflict do nothing;

insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('milk_collection', 'milk-collection.cost-per-liter', array['view']::text[], 'own_branch'),
('manager', 'milk-collection.cost-per-liter', array['view']::text[], 'own_branch'),
('finance', 'milk-collection.cost-per-liter', array['view']::text[], 'all')
on conflict (role, feature_key) do nothing;

-- Do qadam, do alag ijazat -- jaan boojh kar. Manager 'verify' kar sakta
-- hai magar 'approve' nahi; milk wale 'approve' kar sakte hain. Ek hi
-- shakhs ko dono dena is poore intezaam ka maqsad khatam kar deta hai.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('manager', 'milk-collection.maintenance', array['view','create','verify']::text[], 'own_branch')
on conflict (role, feature_key) do update set actions = excluded.actions;

update role_feature_permissions set actions = array['view','create','approve','reject']
where role = 'milk_collection' and feature_key = 'milk-collection.maintenance';
