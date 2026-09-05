-- =====================================================================
-- Migration 114: Wo cheez jo qanoon nahi torti, magar tarteeb torti hai
-- =====================================================================
-- Step 1 se 9 tak har rok QANOON ki rok hai: debit credit ke barabar ho,
-- farq ki wajah likhi jaye, ginti chhoote nahi. Ye sab pakarti hain ke
-- kisi ne USOOL torha.
--
-- Magar sab se maheen nuqsan usool nahi torta. Wo har rok se guzar jata
-- hai, har kaghaz theek rakhta hai, aur phir bhi ghalat hota hai --
-- kyunki wo TARTEEB torta hai:
--
--     Ek branch mein cash ka farq HAR DAFA kam nikalta hai, kabhi zyada
--     nahi. Har farq ki wajah likhi hui hai, har ginti waqt par hui.
--     Har raat qanoon ke mutabiq guzri. Magar ginti ki ghalti ittefaqi
--     hoti hai -- kabhi kam, kabhi zyada. Jo cheez hamesha ek hi taraf
--     jhukti ho, wo ghalti nahi hoti.
--
-- Ye baat kisi ek raat ko dekh kar maloom nahi ho sakti. Wo sirf
-- tarteeb mein nazar aati hai.
--
-- YAHAN AI ISTEMAL NAHI HOTA, aur ye faisla jaan boojh kar hai.
--
-- Ye safha logon ke naam le kar baat karta hai. Aisi baat ka har lafz
-- kisi khane se nikalna chahiye aur dobara ginne par wohi nikalna
-- chahiye. AI se poochhein to jawab har dafa thora mukhtalif aata hai
-- aur wajah kabhi poori nahi milti -- yani jis shakhs par baat ho rahi
-- ho, us ko jawab dene ka mauqa hi nahi milta. Ye saada hisaab hai:
-- ginti, aur ginti dikhai bhi jati hai.
--
-- Aur ek usool sab par lagta hai: NAMOONA CHHOTA HO TO KUCH NAHI KAHA
-- JATA. Teen raaton se koi tarteeb nahi banti. Kam data par baat karna
-- sab se aasan hai aur sab se ghalat -- ek dafa kisi be-gunah par ungli
-- uth jaye to log poore nizam par bharosa chhor dete hain, aur phir wo
-- baat bhi nahi suni jati jo sach ho.

create table if not exists anomaly_findings (
  id uuid primary key default uuid_generate_v4(),

  detector text not null,
  -- Kis par baat ho rahi hai -- branch, shakhs, gaari, kisan.
  subject_type text not null,
  subject_id uuid,
  subject_label text not null,

  title text not null,
  detail text not null,
  -- Wo aankre jin par ye baat khari hai. Bina saboot ke baat ilzam
  -- ban jati hai; saboot ke sath wo sawal rehti hai.
  evidence jsonb not null,

  -- Kitne aankron par ginti hui. Ye hamesha dikhaya jata hai, taake
  -- parhne wala khud andaza laga sake ke baat kitni mazboot hai.
  sample_size int not null,
  severity text not null,

  detected_on date not null default current_date,

  -- 'open'      -- abhi dekhi nahi gayi
  -- 'reviewed'  -- dekh li, wajah maqool thi
  -- 'confirmed' -- dekh li, waqai masla tha
  status text not null default 'open',
  review_note varchar(255),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,

  created_at timestamptz not null default now()
);

alter table anomaly_findings drop constraint if exists chk_anomaly_severity;
alter table anomaly_findings add constraint chk_anomaly_severity
  check (severity in ('high', 'medium', 'low'));

alter table anomaly_findings drop constraint if exists chk_anomaly_status;
alter table anomaly_findings add constraint chk_anomaly_status
  check (status in ('open', 'reviewed', 'confirmed'));

-- Namoona chhota ho to baat banti hi nahi. Ye rok database mein is liye
-- hai ke kal koi naya detector likhte waqt ye usool bhoolna aasan hai --
-- aur us ki qeemat kisi be-gunah shakhs ko deni parti hai.
alter table anomaly_findings drop constraint if exists chk_anomaly_sample;
alter table anomaly_findings add constraint chk_anomaly_sample
  check (sample_size >= 5);

-- Dekh lene par wajah lazmi. "Dekh liya" likh dena aur kuch na dekhna --
-- dono ek jaise nazar aate hain; wajah likhna un mein farq daalta hai.
alter table anomaly_findings drop constraint if exists chk_anomaly_review;
alter table anomaly_findings add constraint chk_anomaly_review
  check (
    status = 'open'
    or (review_note is not null and length(btrim(review_note)) >= 5 and reviewed_by is not null)
  );

-- Ek din mein ek detector, ek subject par ek hi baat.
create unique index if not exists idx_anomaly_once
  on anomaly_findings(detector, subject_label, detected_on);

create index if not exists idx_anomaly_open on anomaly_findings(status, detected_on desc);

create or replace function fn_anomaly_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Ye baat mitayi nahi ja sakti. Dekh kar band ki ja sakti hai.';
  end if;
  if old.status <> 'open' then
    raise exception 'Ye baat pehle hi dekhi ja chuki hai.';
  end if;
  if new.evidence is distinct from old.evidence
     or new.sample_size is distinct from old.sample_size
     or new.detector is distinct from old.detector then
    raise exception 'Saboot badla nahi ja sakta — sirf faisla likha ja sakta hai.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_anomaly_guard on anomaly_findings;
create trigger trg_anomaly_guard
  before update or delete on anomaly_findings
  for each row execute function fn_anomaly_guard();

alter table anomaly_findings enable row level security;

drop policy if exists staff_read_anomaly on anomaly_findings;
create policy staff_read_anomaly on anomaly_findings for select using (fn_is_any_staff());
drop policy if exists staff_write_anomaly on anomaly_findings;
create policy staff_write_anomaly on anomaly_findings for insert with check (fn_is_any_staff());
drop policy if exists staff_review_anomaly on anomaly_findings;
create policy staff_review_anomaly on anomaly_findings for update
  using (fn_is_any_staff()) with check (fn_is_any_staff());

insert into features (key, label, route, icon, is_sensitive) values
('anomalies', 'Ghair-maamooli Tarteeb', '/admin/anomalies', 'Bell', true)
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_sensitive = excluded.is_sensitive;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
('master', 'anomalies', 11),
('finance', 'anomalies', 10)
on conflict do nothing;

-- Ye safha naam le kar baat karta hai, is liye sirf un ke paas jo us par
-- faisla karte hain -- aur jo us shakhs se khud baat kar sakte hain.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('finance', 'anomalies', array['view','edit','export']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
