-- =====================================================================
-- Migration 112: Roz ka khud-kar milaan
-- =====================================================================
-- Step 1 se 6 tak har rok apni jagah lag chuki hai. Magar un sab mein
-- ek hi kamzori mushtarak hai: un ko dekhne ke liye kisi ko SAFHA
-- KHOLNA parta hai.
--
-- Aur haqeeqat ye hai ke koi nahi kholta. Jis din sab theek ho us din
-- safha kholna bekaar lagta hai, aur jis din kuch ghalat ho usi din
-- sab se zyada masroofiyat hoti hai. Natija ye ke jo cheez sab se zyada
-- tawajjah maangti hai, wohi sab se der se nazar aati hai.
--
-- Is liye ab system khud roz dekhta hai, aur ek nateeja likh deta hai.
--
-- Do baatein is amal ko kaam ka banati hain, aur dono par is migration
-- mein rok hai:
--
--   1) "CHECK NAHI HO SAKA" ko "THEEK HAI" nahi ginaya jata.
--
--      Ye sab se aam aur sab se mehnga jhoot hai. Data na mile to
--      report khud ko sabz dikha deti hai, aur jitna data kam hota
--      jata hai utni report achhi hoti jati hai -- yani jab system
--      sab se kam jaanta hai tab sab se zyada tasalli deta hai. Yahan
--      teesra nateeja alag darj hota hai.
--
--   2) Jo baat nikle, wo band karni PARTI hai -- wajah likh kar.
--
--      Aisi fehrist jo har roz barhti rahe aur koi us par kuch na
--      kare, kuch arse baad "aam" lagne lagti hai aur log us ko dekhna
--      chhor dete hain. Us waqt wo fehrist na hone se bhi buri ho jati
--      hai, kyunki us ki maujoodgi ye tasalli deti hai ke koi dekh
--      raha hai. Is liye har baat ki umar ginti hai.

-- ---------------------------------------------------------------
-- 1) Roz ka nateeja
-- ---------------------------------------------------------------
create table if not exists reconciliation_runs (
  id uuid primary key default uuid_generate_v4(),
  run_date date not null,
  ran_at timestamptz not null default now(),

  checks_total int not null default 0,
  checks_passed int not null default 0,
  checks_failed int not null default 0,
  -- Wo jaanch jo chal hi na saki -- data hi na hone ki wajah se.
  checks_skipped int not null default 0,

  -- 'clean'    -- sab jaanch guzar gayi
  -- 'issues'   -- kuch nikla
  -- 'partial'  -- kuch jaanch chal hi nahi saki
  verdict text not null,
  summary text,

  triggered_by text not null default 'cron',
  created_at timestamptz not null default now()
);

alter table reconciliation_runs drop constraint if exists chk_recon_verdict;
alter table reconciliation_runs add constraint chk_recon_verdict
  check (verdict in ('clean', 'issues', 'partial'));

-- Jaanch ka nateeja apne hisson se mail khana chahiye. Ye rok is liye
-- hai ke "8 mein se 8 theek" likh dena aur asal mein 3 jaanch chalna
-- hi na -- yahi wo soorat hai jis se report jhooti tasalli deti hai.
alter table reconciliation_runs drop constraint if exists chk_recon_counts;
alter table reconciliation_runs add constraint chk_recon_counts
  check (checks_total = checks_passed + checks_failed + checks_skipped);

-- Sabz nateeja tabhi jab koi jaanch na to nakaam hui, na chhooti.
alter table reconciliation_runs drop constraint if exists chk_recon_clean;
alter table reconciliation_runs add constraint chk_recon_clean
  check (
    (verdict = 'clean' and checks_failed = 0 and checks_skipped = 0)
    or (verdict = 'partial' and checks_skipped > 0)
    or (verdict = 'issues' and checks_failed > 0)
  );

create unique index if not exists idx_recon_run_once on reconciliation_runs(run_date);
create index if not exists idx_recon_run_date on reconciliation_runs(run_date desc);

-- ---------------------------------------------------------------
-- 2) Jo baatein nikleen
-- ---------------------------------------------------------------
create table if not exists reconciliation_findings (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references reconciliation_runs(id) on delete cascade,

  check_key text not null,
  -- 'red'   -- paisa abhi khatre mein hai
  -- 'amber' -- dekh lena chahiye
  -- 'grey'  -- jaanch chal hi nahi saki
  severity text not null,

  title text not null,
  detail text not null,
  amount numeric(14,2),
  href text,

  -- Pehli dafa kab nikli. Rozana ki jaanch mein wohi baat baar baar
  -- nikalti hai; umar isi se ginti hai, na ke aaj ki tareekh se.
  first_seen_date date not null default current_date,

  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  resolution_note varchar(255),

  created_at timestamptz not null default now()
);

alter table reconciliation_findings drop constraint if exists chk_finding_severity;
alter table reconciliation_findings add constraint chk_finding_severity
  check (severity in ('red', 'amber', 'grey'));

-- Band karne ke liye wajah lazmi. Bina wajah ke band karna aur nazar
-- andaz karna -- dono ka anjaam ek hai, magar pehla record mein "hal ho
-- gaya" likh deta hai. Ye us se bura hai ke kuch na kiya jaye.
alter table reconciliation_findings drop constraint if exists chk_finding_resolution;
alter table reconciliation_findings add constraint chk_finding_resolution
  check (
    resolved_at is null
    or (resolution_note is not null and length(btrim(resolution_note)) >= 5 and resolved_by is not null)
  );

create index if not exists idx_finding_run on reconciliation_findings(run_id);
create index if not exists idx_finding_open on reconciliation_findings(check_key, resolved_at);

-- Band ho gayi baat dobara khuli nahi. Warna wajah likh kar band karna
-- aur phir chup chaap khol dena mumkin ho jata, aur record us ka
-- nishan tak na rakhta.
create or replace function fn_finding_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Milaan ki baat mitayi nahi ja sakti.';
  end if;
  if old.resolved_at is not null then
    raise exception 'Ye baat band ho chuki hai. Dobara nikle to agli jaanch mein khud aa jayegi.';
  end if;
  if new.check_key is distinct from old.check_key
     or new.amount is distinct from old.amount
     or new.first_seen_date is distinct from old.first_seen_date then
    raise exception 'Jaanch ka nateeja badla nahi ja sakta — sirf band kiya ja sakta hai.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_finding_guard on reconciliation_findings;
create trigger trg_finding_guard
  before update or delete on reconciliation_findings
  for each row execute function fn_finding_guard();

-- ---------------------------------------------------------------
-- 3) Khuli hui baatein -- aur un ki umar
-- ---------------------------------------------------------------
create or replace view v_open_findings
with (security_invoker = true) as
  select
    f.id, f.check_key, f.severity, f.title, f.detail, f.amount, f.href,
    f.first_seen_date,
    (current_date - f.first_seen_date) as din_purani,
    r.run_date
  from reconciliation_findings f
  join reconciliation_runs r on r.id = f.run_id
  where f.resolved_at is null
    -- Sirf aakhri jaanch wali baatein. Purani jaanchon ki wohi baat
    -- dobara dikhana fehrist ko teen guna kar deta hai aur log us ko
    -- dekhna chhor dete hain.
    and r.run_date = (select max(run_date) from reconciliation_runs);

-- ---------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------
alter table reconciliation_runs enable row level security;
alter table reconciliation_findings enable row level security;

drop policy if exists staff_read_recon_runs on reconciliation_runs;
create policy staff_read_recon_runs on reconciliation_runs for select using (fn_is_any_staff());
drop policy if exists staff_write_recon_runs on reconciliation_runs;
create policy staff_write_recon_runs on reconciliation_runs for insert with check (fn_is_any_staff());

drop policy if exists staff_read_recon_findings on reconciliation_findings;
create policy staff_read_recon_findings on reconciliation_findings for select using (fn_is_any_staff());
drop policy if exists staff_write_recon_findings on reconciliation_findings;
create policy staff_write_recon_findings on reconciliation_findings for insert with check (fn_is_any_staff());
drop policy if exists staff_resolve_recon_findings on reconciliation_findings;
create policy staff_resolve_recon_findings on reconciliation_findings for update
  using (fn_is_any_staff()) with check (fn_is_any_staff());

-- ---------------------------------------------------------------
-- 5) Safha
-- ---------------------------------------------------------------
insert into features (key, label, route, icon, is_sensitive) values
('reconciliation', 'Roz ka Milaan', '/admin/reconciliation', 'ClipboardCheck', true)
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_sensitive = excluded.is_sensitive;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
('master', 'reconciliation', 8),
('finance', 'reconciliation', 7),
('admin', 'reconciliation', 19)
on conflict do nothing;

insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('finance', 'reconciliation', array['view','edit','export']::text[], 'all'),
('manager', 'reconciliation', array['view']::text[], 'own_branch')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
