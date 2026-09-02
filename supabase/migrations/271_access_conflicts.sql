-- =====================================================================
-- AgriBridge — Migration 271: Ijazat ka takraao (Excessive / Conflicting Access)
-- =====================================================================
-- Malik ka usool (2 September, priority 1):
--   "Separation of Duties primary principle ho. Create Payment + Verify
--    Same Payment + Reverse ek hi user ko unrestricted na mile. Rules
--    configurable hon, code mein hard-code na hon. Conflict sirf feature
--    naam par nahi, action + department + scope dekh kar. AI detect
--    kare, samjhaye, behtar combination bataye -- faisla insaan ka.
--    Existing permissions migration ke baad khud na badlein: pehle
--    baseline scan."
--
-- Kya banta hai:
--   access_conflict_rules     -- qawaid (SoD / cross-department / sensitive load), badalne ke qabil
--   fn_access_conflicts()     -- asal ijazat (role + extra_roles + user grants) par qawaid chala kar takraao
--                                p_extra_* de kar "agar ye bhi mil jaye to" (pre-approval check)
--   access_conflict_findings  -- scan ka nateeja, fingerprint par ek qatar; status open/acknowledged/overridden/resolved
--   access_conflict_events    -- append-only silsila (detected, acknowledged, overridden, ...)
--   access_conflict_scans     -- har scan ka khulasa
--   fn_run_access_conflict_scan() -- baseline / manual scan; KUCH REVOKE NAHI KARTA
--   access_requests           -- conflict_check, override_* (manzoori par jaanch aur override ka record)
--
-- Scope ka usool: ek hi banday ki do ijazatein hamesha us ke apne
-- records par mil jati hain (own_records < own_shop < own_branch < all),
-- is liye "alag scope = koi takraao nahi" andha faisla nahi hota. Rule
-- ka min_scope kehta hai kis scope se upar poori severity lage; us se
-- neeche narrow_scope_severity (ya null = takraao nahi).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Qawaid
-- ---------------------------------------------------------------------
create table if not exists access_conflict_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null default 'sod',
  label text not null,
  description text,
  severity text not null default 'high',
  enforcement text not null default 'advise',
  -- sod: [{"label":"Adaigi banana","features":["payouts"],"actions":["create"]}, ...]
  -- Takraao tab jab HAR duty poori ho (feature in features AND action in actions).
  duties jsonb not null default '[]'::jsonb,
  min_scope text not null default 'own_records',
  narrow_scope_severity text,
  -- cross_department / sensitive_load: {"threshold": 3}
  params jsonb not null default '{}'::jsonb,
  applies_to_departments text[],
  exempt_roles text[] not null default array['owner','super_admin','admin'],
  recommendation text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_acr_kind check (kind in ('sod', 'cross_department', 'sensitive_load')),
  constraint chk_acr_severity check (severity in ('info', 'warning', 'high', 'critical')),
  constraint chk_acr_narrow check (narrow_scope_severity is null or narrow_scope_severity in ('info', 'warning', 'high', 'critical')),
  constraint chk_acr_enforcement check (enforcement in ('advise', 'override', 'block')),
  constraint chk_acr_min_scope check (min_scope in ('all', 'own_branch', 'own_shop', 'own_records')),
  constraint chk_acr_duties check (kind <> 'sod' or jsonb_typeof(duties) = 'array')
);
comment on table access_conflict_rules is 'Ijazat ke takraao ke qawaid (271). Code mein kuch hard-code nahi -- yahin badlein. enforcement: advise = sirf batao; override = HIGH/CRITICAL par Owner/Admin wajah likh kar de sakta hai; block = koi nahi.';

-- ---------------------------------------------------------------------
-- 2. Scan, findings, events
-- ---------------------------------------------------------------------
create table if not exists access_conflict_scans (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'manual',
  run_by uuid references profiles(id),
  run_at timestamptz not null default now(),
  users_checked int,
  findings int,
  new_findings int,
  resolved int,
  by_severity jsonb,
  constraint chk_acs_trigger check (trigger in ('baseline', 'manual', 'approval', 'scheduled'))
);

create table if not exists access_conflict_findings (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  profile_id uuid not null references profiles(id) on delete cascade,
  rule_id uuid references access_conflict_rules(id) on delete set null,
  rule_code text not null,
  kind text not null,
  label text not null,
  severity text not null,
  enforcement text not null,
  matched jsonb not null default '[]'::jsonb,
  recommendation text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_scan_id uuid references access_conflict_scans(id),
  status text not null default 'open',
  status_by uuid references profiles(id),
  status_at timestamptz,
  status_note text,
  override_expires_at timestamptz,
  resolved_reason text,
  constraint chk_acf_status check (status in ('open', 'acknowledged', 'overridden', 'resolved')),
  constraint chk_acf_severity check (severity in ('info', 'warning', 'high', 'critical'))
);
create index if not exists idx_acf_profile on access_conflict_findings (profile_id, status);
create index if not exists idx_acf_status on access_conflict_findings (status, severity);

create table if not exists access_conflict_events (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid references access_conflict_findings(id) on delete cascade,
  request_id uuid references access_requests(id) on delete set null,
  scan_id uuid references access_conflict_scans(id) on delete set null,
  actor_id uuid references profiles(id),
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ace_finding on access_conflict_events (finding_id, created_at);
create index if not exists idx_ace_request on access_conflict_events (request_id, created_at);
comment on table access_conflict_events is 'Append-only: detect, acknowledge, override, expire, resolve, approval par jaanch (271). Kabhi update/delete nahi.';

-- Darkhwast par jaanch aur override ka record
alter table access_requests add column if not exists conflict_check jsonb;
alter table access_requests add column if not exists override_reason text;
alter table access_requests add column if not exists override_by uuid references profiles(id);
alter table access_requests add column if not exists override_at timestamptz;
alter table access_requests add column if not exists override_expires_at timestamptz;

-- ---------------------------------------------------------------------
-- 3. Kaun dekh sakta hai
-- ---------------------------------------------------------------------
create or replace function fn_can_review_access()
returns boolean language sql stable as $$
  select auth.uid() is null
      or exists (select 1 from profiles p where p.id = auth.uid() and p.is_active
                 and p.role::text in ('owner','super_admin','admin','manager'))
      or exists (select 1 from department_head_grants g where g.profile_id = auth.uid()
                 and (g.starts_at is null or g.starts_at <= now())
                 and (g.expires_at is null or g.expires_at > now()));
$$;

alter table access_conflict_rules enable row level security;
alter table access_conflict_scans enable row level security;
alter table access_conflict_findings enable row level security;
alter table access_conflict_events enable row level security;

drop policy if exists acr_read on access_conflict_rules;
create policy acr_read on access_conflict_rules for select to authenticated using (fn_can_review_access());
drop policy if exists acs_read on access_conflict_scans;
create policy acs_read on access_conflict_scans for select to authenticated using (fn_can_review_access());
drop policy if exists acf_read on access_conflict_findings;
create policy acf_read on access_conflict_findings for select to authenticated using (fn_can_review_access() or profile_id = auth.uid());
drop policy if exists ace_read on access_conflict_events;
create policy ace_read on access_conflict_events for select to authenticated using (fn_can_review_access());
drop policy if exists ace_insert on access_conflict_events;
create policy ace_insert on access_conflict_events for insert to authenticated
  with check (fn_can_review_access() and actor_id = auth.uid());
-- Rules / findings / scans ka likhna sirf service role (lib) se -- wahan
-- role aur ceiling ki jaanch hoti hai.

-- ---------------------------------------------------------------------
-- 4. Takraao nikalna
-- ---------------------------------------------------------------------
-- p_profile null = sab log. p_extra_* = "agar ye ijazat bhi mil jaye" (manzoori
-- se pehle ki jaanch). involves_extra = ye takraao us nayi ijazat se banta hai.
create or replace function fn_access_conflicts(
  p_profile uuid default null,
  p_extra_feature text default null,
  p_extra_actions text[] default null,
  p_extra_scope text default null
)
returns table (
  profile_id uuid,
  full_name text,
  role text,
  rule_id uuid,
  rule_code text,
  kind text,
  label text,
  severity text,
  enforcement text,
  recommendation text,
  matched jsonb,
  fingerprint text,
  involves_extra boolean
)
language sql stable security definer set search_path = public as $$
with acc as (
  -- Wohi teen raaste jo v_user_feature_access (104/193) mein hain, sath
  -- mein source -- taake samjhaya ja sake ke ijazat kahan se aayi.
  select p.id as profile_id, rfp.feature_key, a.action, rfp.data_scope, 'role:' || p.role::text as source
    from profiles p
    join role_feature_permissions rfp on rfp.role = p.role::text
    join features f on f.key = rfp.feature_key and f.is_active
    cross join lateral unnest(rfp.actions) a(action)
   where p.is_active and (p_profile is null or p.id = p_profile)
  union all
  select p.id, rfp.feature_key, a.action, rfp.data_scope, 'role:' || er.role::text
    from profiles p
    cross join lateral unnest(p.extra_roles) er(role)
    join role_feature_permissions rfp on rfp.role = er.role::text
    join features f on f.key = rfp.feature_key and f.is_active
    cross join lateral unnest(rfp.actions) a(action)
   where p.is_active and (p_profile is null or p.id = p_profile)
  union all
  select ufp.profile_id, ufp.feature_key, a.action, ufp.data_scope,
         case when ufp.expires_at is null then 'user' else 'user:temp' end
    from user_feature_permissions ufp
    join features f on f.key = ufp.feature_key and f.is_active
    cross join lateral unnest(ufp.actions) a(action)
   where (ufp.starts_at is null or ufp.starts_at <= now())
     and (ufp.expires_at is null or ufp.expires_at > now())
     and (p_profile is null or ufp.profile_id = p_profile)
  union all
  select p_profile, p_extra_feature, a.action, coalesce(p_extra_scope, 'own_branch'), 'preview'
    from unnest(coalesce(p_extra_actions, '{}'::text[])) a(action)
   where p_profile is not null and p_extra_feature is not null
),
acc_r as (
  select acc.*, case acc.data_scope when 'all' then 4 when 'own_branch' then 3 when 'own_shop' then 2 else 1 end as rank
    from acc
),
people as (
  select p.id, p.full_name, p.role::text as role, coalesce(p.extra_roles::text[], '{}'::text[]) as extra
    from profiles p
   where p.is_active and (p_profile is null or p.id = p_profile)
),
rules as (
  select r.*, case r.min_scope when 'all' then 4 when 'own_branch' then 3 when 'own_shop' then 2 else 1 end as min_rank
    from access_conflict_rules r where r.is_active
),
-- ---- SoD ----
sod_duty as (
  select r.id as rule_id, d.ord, d.duty
    from rules r
    cross join lateral jsonb_array_elements(r.duties) with ordinality d(duty, ord)
   where r.kind = 'sod'
),
sod_match as (
  select pe.id as profile_id, sd.rule_id, sd.ord, a.feature_key,
         jsonb_build_object(
           'duty', sd.duty->>'label',
           'feature_key', a.feature_key,
           'actions', jsonb_agg(distinct a.action),
           'scope', case max(a.rank) when 4 then 'all' when 3 then 'own_branch' when 2 then 'own_shop' else 'own_records' end,
           'sources', jsonb_agg(distinct a.source),
           'preview', bool_or(a.source = 'preview')
         ) as m,
         max(a.rank) as rank,
         bool_or(a.source = 'preview') as preview
    from people pe
    cross join sod_duty sd
    join acc_r a on a.profile_id = pe.id
     and a.feature_key = any (array(select jsonb_array_elements_text(sd.duty->'features')))
     and a.action = any (array(select jsonb_array_elements_text(sd.duty->'actions')))
   group by pe.id, sd.rule_id, sd.ord, sd.duty, a.feature_key
),
sod_hit as (
  select sm.profile_id, sm.rule_id,
         jsonb_agg(sm.m order by sm.ord, sm.feature_key) as matched,
         min(sm.rank) as min_rank,
         bool_or(sm.preview) as preview,
         count(distinct sm.ord) as n_duties,
         string_agg(distinct sm.feature_key, ',' order by sm.feature_key) as fkeys
    from sod_match sm
   group by sm.profile_id, sm.rule_id
),
sod_out as (
  select h.profile_id, r.id as rule_id, r.code, r.kind, r.label,
         case when h.min_rank >= r.min_rank then r.severity else r.narrow_scope_severity end as severity,
         r.enforcement, r.recommendation, h.matched, h.preview, h.fkeys
    from sod_hit h
    join rules r on r.id = h.rule_id
   where h.n_duties = jsonb_array_length(r.duties)
     and (case when h.min_rank >= r.min_rank then r.severity else r.narrow_scope_severity end) is not null
),
-- ---- Department se bahar ki ijazatein (sirf user grants, view se zyada) ----
cd_rows as (
  select pe.id as profile_id, r.id as rule_id, a.feature_key,
         jsonb_agg(distinct a.action) as actions,
         case max(a.rank) when 4 then 'all' when 3 then 'own_branch' when 2 then 'own_shop' else 'own_records' end as scope,
         jsonb_agg(distinct a.source) as sources,
         bool_or(a.source = 'preview') as preview
    from people pe
    cross join rules r
    join acc_r a on a.profile_id = pe.id
   where r.kind = 'cross_department'
     and a.source not like 'role:%'
     and a.action <> 'view'
     and not exists (
       select 1 from departments d
       join dashboard_features df on df.dashboard_key = d.dashboard_key
       where (d.role = pe.role or d.role = any (pe.extra)) and df.feature_key = a.feature_key
     )
   group by pe.id, r.id, a.feature_key
),
cd_out as (
  select c.profile_id, r.id as rule_id, r.code, r.kind, r.label, r.severity, r.enforcement, r.recommendation,
         jsonb_agg(jsonb_build_object('duty', 'Department se bahar', 'feature_key', c.feature_key, 'actions', c.actions, 'scope', c.scope, 'sources', c.sources, 'preview', c.preview) order by c.feature_key) as matched,
         bool_or(c.preview) as preview,
         string_agg(c.feature_key, ',' order by c.feature_key) as fkeys
    from cd_rows c
    join rules r on r.id = c.rule_id
   group by c.profile_id, r.id, r.code, r.kind, r.label, r.severity, r.enforcement, r.recommendation, r.params
  having count(*) >= coalesce((r.params->>'threshold')::int, 3)
),
-- ---- Hassas features par view se zyada ka bojh ----
sl_rows as (
  select pe.id as profile_id, r.id as rule_id, a.feature_key,
         jsonb_agg(distinct a.action) as actions,
         case max(a.rank) when 4 then 'all' when 3 then 'own_branch' when 2 then 'own_shop' else 'own_records' end as scope,
         jsonb_agg(distinct a.source) as sources,
         bool_or(a.source = 'preview') as preview
    from people pe
    cross join rules r
    join acc_r a on a.profile_id = pe.id
    join features f on f.key = a.feature_key and f.is_sensitive
   where r.kind = 'sensitive_load' and a.action <> 'view'
   group by pe.id, r.id, a.feature_key
),
sl_out as (
  select s.profile_id, r.id as rule_id, r.code, r.kind, r.label, r.severity, r.enforcement, r.recommendation,
         jsonb_agg(jsonb_build_object('duty', 'Hassas feature', 'feature_key', s.feature_key, 'actions', s.actions, 'scope', s.scope, 'sources', s.sources, 'preview', s.preview) order by s.feature_key) as matched,
         bool_or(s.preview) as preview,
         string_agg(s.feature_key, ',' order by s.feature_key) as fkeys
    from sl_rows s
    join rules r on r.id = s.rule_id
   group by s.profile_id, r.id, r.code, r.kind, r.label, r.severity, r.enforcement, r.recommendation, r.params
  having count(*) >= coalesce((r.params->>'threshold')::int, 6)
),
allhits as (
  select * from sod_out
  union all select * from cd_out
  union all select * from sl_out
)
select h.profile_id, pe.full_name, pe.role, h.rule_id, h.code, h.kind, h.label, h.severity, h.enforcement, h.recommendation,
       h.matched,
       md5(h.profile_id::text || '|' || h.code || '|' || h.fkeys) as fingerprint,
       h.preview
  from allhits h
  join people pe on pe.id = h.profile_id
  join rules r on r.id = h.rule_id
 where not (pe.role = any (r.exempt_roles))
   and (r.applies_to_departments is null
        or exists (select 1 from departments d
                    where d.key = any (r.applies_to_departments)
                      and (d.role = pe.role or d.role = any (pe.extra))))
 order by case h.severity when 'critical' then 4 when 'high' then 3 when 'warning' then 2 else 1 end desc, pe.full_name, h.code;
$$;

revoke all on function fn_access_conflicts(uuid, text, text[], text) from public;
grant execute on function fn_access_conflicts(uuid, text, text[], text) to authenticated, service_role;

comment on function fn_access_conflicts is 'Asal ijazat (role + extra_roles + user grants) par qawaid. p_extra_* = "agar ye bhi mil jaye" (271). Kuch badalta nahi.';

-- ---------------------------------------------------------------------
-- 5. Scan: nateeja mehfooz, KUCH REVOKE NAHI
-- ---------------------------------------------------------------------
create or replace function fn_run_access_conflict_scan(p_trigger text default 'manual', p_actor uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_scan uuid;
  v_new int := 0;
  v_resolved int := 0;
  v_total int := 0;
  r record;
  f record;
begin
  if not fn_can_review_access() then
    raise exception 'Sirf Owner/Admin/Manager ya department head scan chala sakta hai';
  end if;

  insert into access_conflict_scans (trigger, run_by) values (p_trigger, p_actor) returning id into v_scan;

  create temp table if not exists tmp_seen (fingerprint text primary key) on commit drop;
  truncate tmp_seen;

  for r in select * from fn_access_conflicts(null, null, null, null) loop
    v_total := v_total + 1;
    insert into tmp_seen values (r.fingerprint) on conflict do nothing;

    select * into f from access_conflict_findings where fingerprint = r.fingerprint;
    if not found then
      insert into access_conflict_findings (fingerprint, profile_id, rule_id, rule_code, kind, label, severity, enforcement, matched, recommendation, last_scan_id)
      values (r.fingerprint, r.profile_id, r.rule_id, r.rule_code, r.kind, r.label, r.severity, r.enforcement, r.matched, r.recommendation, v_scan)
      returning * into f;
      v_new := v_new + 1;
      insert into access_conflict_events (finding_id, scan_id, actor_id, event, detail)
      values (f.id, v_scan, p_actor, 'detected', jsonb_build_object('severity', r.severity, 'matched', r.matched));
    else
      update access_conflict_findings
         set last_seen_at = now(), last_scan_id = v_scan, matched = r.matched, severity = r.severity,
             enforcement = r.enforcement, recommendation = r.recommendation, label = r.label, rule_id = r.rule_id
       where id = f.id;
      if f.status = 'resolved' then
        update access_conflict_findings set status = 'open', status_by = null, status_at = now(), status_note = null, resolved_reason = null where id = f.id;
        insert into access_conflict_events (finding_id, scan_id, actor_id, event, detail)
        values (f.id, v_scan, p_actor, 're_detected', jsonb_build_object('severity', r.severity));
        v_new := v_new + 1;
      elsif f.status = 'overridden' and f.override_expires_at is not null and f.override_expires_at <= now() then
        update access_conflict_findings set status = 'open', status_at = now() where id = f.id;
        insert into access_conflict_events (finding_id, scan_id, actor_id, event, detail)
        values (f.id, v_scan, p_actor, 'override_expired', jsonb_build_object('override_expires_at', f.override_expires_at));
      end if;
    end if;
  end loop;

  -- Jo ab nazar nahi aaye (ijazat hat gayi ya miyaad khatam) -- resolved, wajah likhi
  for f in select * from access_conflict_findings
            where status in ('open', 'acknowledged', 'overridden')
              and fingerprint not in (select fingerprint from tmp_seen) loop
    update access_conflict_findings
       set status = 'resolved', status_at = now(), resolved_reason = 'no_longer_detected', last_scan_id = v_scan
     where id = f.id;
    insert into access_conflict_events (finding_id, scan_id, actor_id, event, detail)
    values (f.id, v_scan, p_actor, 'resolved', jsonb_build_object('reason', 'no_longer_detected', 'previous_status', f.status));
    v_resolved := v_resolved + 1;
  end loop;

  update access_conflict_scans
     set users_checked = (select count(*) from profiles where is_active),
         findings = v_total, new_findings = v_new, resolved = v_resolved,
         by_severity = (select coalesce(jsonb_object_agg(sev, n), '{}'::jsonb)
                          from (select severity as sev, count(*) as n from access_conflict_findings
                                 where status <> 'resolved' group by severity) x)
   where id = v_scan;
  return v_scan;
end;
$$;

revoke all on function fn_run_access_conflict_scan(text, uuid) from public;
grant execute on function fn_run_access_conflict_scan(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Qawaid ka pehla set (badalne ke qabil -- /admin/access-requests, Conflicts > Qawaid)
-- ---------------------------------------------------------------------
-- Reversal (ulta karna) engine mein alag action nahi -- ledger-reversal
-- role se rukta hai. Yahan cash book (finance) ka 'edit' us ka qareeb
-- tareen nishan hai; jab reversal ka apna feature bane, rule yahin badlein.
insert into access_conflict_rules (code, kind, label, description, severity, enforcement, duties, min_scope, narrow_scope_severity, recommendation) values
  ('SOD-PAY-CREATE-APPROVE', 'sod', 'Adaigi banana + usi ko manzoor/tasdeeq karna',
   'Ek hi banda supplier/kisan ki adaigi bhi banaye aur manzoor ya tasdeeq bhi kare -- doosri aankh khatam.',
   'high', 'override',
   '[{"label":"Adaigi banana","features":["payouts","purchases.bills","finance","machinery-rental.vendor-cash","grain-procurement.payments"],"actions":["create"]},
     {"label":"Adaigi manzoor / tasdeeq","features":["payouts","submissions","finance","machinery-rental.vendor-settlement","grain-procurement.payments"],"actions":["approve","verify"]}]'::jsonb,
   'own_branch', 'warning',
   'Manzoori/tasdeeq Finance Manager ya Owner ke paas rakhein; banane wala alag ho.'),

  ('SOD-PAY-REVERSE', 'sod', 'Adaigi banana + manzoor karna + ulta karna (teeno ek haath mein)',
   'Create + Verify/Approve + Reverse ek hi user ke paas: adaigi bana kar, manzoor kar ke, phir ulta bhi kar sakta hai -- koi nishan nahi bachta. TEMPORARY PROXY (malik, 2 Sep): "Ulta karna" abhi cash book (finance) ke edit se naapa jata hai kyunke reversal ka apna action-feature nahi. Jab "Reversal / Correct Posted Entry" feature bane, teesri duty us par shift karein -- ye rule permanent nahi.',
   'critical', 'block',
   '[{"label":"Adaigi banana","features":["payouts","purchases.bills","finance"],"actions":["create"]},
     {"label":"Adaigi manzoor / tasdeeq","features":["payouts","submissions","finance"],"actions":["approve","verify"]},
     {"label":"Ulta karna (cash book edit)","features":["finance"],"actions":["edit"]}]'::jsonb,
   'own_branch', 'high',
   'Reverse ki ijazat sirf Finance Manager / Owner ke paas rakhein; banane ya manzoor karne wale ke paas nahi.'),

  ('SOD-CASH-HANDOVER-RECON', 'sod', 'Cash haath badalna + apna hi milaan/close karna',
   'Jo cash de raha hai wohi roz ka milaan ya cash close bhi kare -- kami chhup sakti hai.',
   'high', 'override',
   '[{"label":"Cash dena / rakhna","features":["cash-handover","cash-custody"],"actions":["create","edit"]},
     {"label":"Milaan / cash close","features":["reconciliation","cash-close"],"actions":["edit","approve","verify","create"]}]'::jsonb,
   'own_branch', 'warning',
   'Milaan aur cash close doosra banda kare (Finance ya Owner).'),

  ('SOD-STOCK-COUNT', 'sod', 'Maal ginna + apni hi ginti manzoor karna',
   'Ginti karne wala hi ginti approve kare to farq (kami/chori) kabhi saamne nahi aata.',
   'high', 'override',
   '[{"label":"Ginti karna","features":["stock-count"],"actions":["create","edit"]},
     {"label":"Ginti manzoor","features":["stock-count"],"actions":["approve","verify"]}]'::jsonb,
   'own_shop', 'warning',
   'Ginti warehouse/shop staff kare, manzoori manager ya Owner de.'),

  ('SOD-PURCHASE-APPROVE', 'sod', 'Purchase banana + apni hi purchase manzoor karna',
   'Supplier chun kar purchase banane wala hi manzoor kare to rate aur supplier par koi doosri nazar nahi.',
   'high', 'override',
   '[{"label":"Purchase banana","features":["purchases","purchases.bills"],"actions":["create"]},
     {"label":"Purchase manzoor","features":["purchases","submissions"],"actions":["approve"]}]'::jsonb,
   'own_branch', 'warning',
   'Purchase ki manzoori Owner/Admin ya alag manager ke paas.'),

  ('SOD-PURCHASE-RECEIVE-PAY', 'sod', 'Purchase banana + maal receive karna + adaigi banana',
   'Teen-tarfa milaan (order, maal, bill) ek hi banday ke haath mein -- na aaya maal bhi "aa gaya" aur adaigi ho sakti hai.',
   'warning', 'advise',
   '[{"label":"Purchase banana","features":["purchases"],"actions":["create"]},
     {"label":"Maal receive","features":["inventory.receiving","purchases.grn","purchases"],"actions":["verify","edit"]},
     {"label":"Adaigi banana","features":["payouts","purchases.bills"],"actions":["create"]}]'::jsonb,
   'own_records', null,
   'Receiving warehouse kare, adaigi finance -- kam az kam ek qadam alag haath mein.'),

  ('SOD-USER-PERMISSION', 'sod', 'User banana + ijazat dena',
   'Jo user bana sakta hai wohi ijazat bhi de sakta hai -- apne liye ya kisi ke liye bina doosri nazar ke.',
   'high', 'override',
   '[{"label":"User banana / badalna","features":["users"],"actions":["create","edit"]},
     {"label":"Ijazat dena","features":["permissions","departments","dashboard-manager","product-permissions"],"actions":["assign","edit","create"]}]'::jsonb,
   'own_records', null,
   'Ijazat dena Owner ke paas rakhein; user banana Admin ke paas.'),

  ('SOD-HR-PAY', 'sod', 'Staff ka record badalna + staff ko adaigi banana',
   'Tankhwah/advance ka record badalne wala hi adaigi banaye to ghost salary mumkin hai.',
   'high', 'override',
   '[{"label":"Staff record / tankhwah","features":["hr","hr.team"],"actions":["create","edit"]},
     {"label":"Staff ko adaigi","features":["wallets","staff-khata","payouts"],"actions":["create","approve"]}]'::jsonb,
   'own_branch', 'warning',
   'Tankhwah ki adaigi finance banaye, HR sirf record.'),

  ('SOD-MILK-VERIFY', 'sod', 'Doodh jama karna + apni hi entry tasdeeq karna',
   'Collection entry karne wala hi verify kare to FAT/litre ka farq nahi pakra jata.',
   'high', 'override',
   '[{"label":"Doodh jama","features":["milk-collection.collect","milk-collection","milk-collection.walk-in"],"actions":["create"]},
     {"label":"Tasdeeq","features":["milk-collection.verify"],"actions":["verify","approve"]}]'::jsonb,
   'own_records', 'warning',
   'Verify Milk Manager kare; collector sirf entry.'),

  ('SOD-POS-RETURN-APPROVE', 'sod', 'POS par bechna + wapsi manzoor karna',
   'Bechne wala hi wapsi manzoor kare to jaali return se cash nikal sakta hai.',
   'warning', 'advise',
   '[{"label":"POS bikri","features":["pos"],"actions":["create"]},
     {"label":"Wapsi manzoor","features":["pos.returns"],"actions":["approve","verify"]}]'::jsonb,
   'own_records', null,
   'Wapsi ki manzoori shop manager ya Owner de.'),

  ('SOD-BANK-RECON', 'sod', 'Bank entry banana + bank milaan karna',
   'Bank mein entry karne wala hi milaan kare to ghalat entry kabhi nahi pakri jati.',
   'warning', 'advise',
   '[{"label":"Bank entry","features":["finance.banks"],"actions":["create","edit"]},
     {"label":"Bank milaan","features":["bank-reconcile"],"actions":["edit","approve","verify"]}]'::jsonb,
   'own_records', null,
   'Bank milaan Owner ya doosra finance staff kare.')
on conflict (code) do nothing;

insert into access_conflict_rules (code, kind, label, description, severity, enforcement, params, recommendation) values
  ('XDEPT-EXCESS', 'cross_department', 'Apne department se bahar bohat si ijazatein',
   'User grants (role se alag) jo is banday ke department ke dashboard mein nahi aur view se zyada hain -- itni jama ho gayin ke department ka matlab nahi raha.',
   'warning', 'advise', '{"threshold": 3}'::jsonb,
   'Ya department assign karein (saaf raasta), ya waqti ijazat dein jo khud khatam ho.'),
  ('SENSITIVE-LOAD', 'sensitive_load', 'Hassas features par view se zyada ka bojh',
   'Ek banday ke paas bohat se hassas (is_sensitive) features par create/edit/approve -- ek account compromise ho to nuqsan bara.',
   'info', 'advise', '{"threshold": 6}'::jsonb,
   'Jo roz nahi chahiye wo waqti karein ya hata dein.')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 7. Help aur naqsha
-- ---------------------------------------------------------------------
update feature_help
   set how_steps = array_append(how_steps, '"Takraao" tab: kis ke paas aisi ijazatein ek sath hain jo alag honi chahiyein (SoD). Ye sirf report hai -- kuch khud nahi hatta; faisla aap ka.'),
       mistakes = array_append(mistakes, 'HIGH/CRITICAL takraao ko bina wajah ke override karna -- wajah, kaun, kab aur miyaad likhna lazmi hai.'),
       updated_at = now()
 where feature_key = 'access-requests' and lang = 'rm'
   and not exists (select 1 from unnest(how_steps) s where s like '"Takraao" tab%');

-- ---------------------------------------------------------------------
-- 8. Baseline scan -- report banti hai, koi ijazat nahi badalti
-- ---------------------------------------------------------------------
select fn_run_access_conflict_scan('baseline', null);
