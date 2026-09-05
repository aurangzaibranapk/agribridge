-- =====================================================================
-- AgriBridge — Migration 270: Ijazat ki darkhwast (AI se draft, insaan se manzoori)
-- =====================================================================
-- Guided ERP ka qadam G (malik ka nukta, 2 September):
--   "AI intent ko permission ke draft mein badalta hai; authorized
--    insaan manzoor karta hai; permission engine lagata hai. AI kabhi
--    RBAC, data scope, department hierarchy ya approval ko bypass na
--    kare."
--
-- Naya parallel system NAHI: ijazat wahi user_feature_permissions
-- (104) hai, jo v_user_feature_access se chalti hai aur expires_at par
-- khud khatam hoti hai. Yahan sirf DARKHWAST aur us ka silsila hai.
--
-- access_requests: kis ke liye, kya (feature + actions + scope), kab
-- tak, kyun, AI ne kya samjha, kis ne faisla kiya, purani aur nayi
-- ijazat. access_request_events: append-only -- kabhi update/delete
-- nahi (RLS mein sirf select aur insert).
--
-- High-risk (finance approval/verify, users/permissions/security,
-- reversal, cross-department, delegation): sirf Owner/Admin manzoor
-- kare; department head nahi. Head apni ceiling ke andar (capGrant).
-- =====================================================================

create sequence if not exists access_request_seq start 1;

create or replace function fn_next_access_request_number()
returns text language sql as $$
  select 'ACC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('access_request_seq')::text, 5, '0');
$$;

create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default fn_next_access_request_number(),
  kind text not null default 'feature_access',
  requested_for uuid not null references profiles(id),
  requested_by uuid not null references profiles(id),
  feature_key text references features(key) on delete set null,
  department_key text,
  actions text[] not null default '{}',
  data_scope text not null default 'own_branch',
  branch_id uuid references branches(id),
  reason text,
  duration text not null default 'permanent',
  starts_at timestamptz,
  expires_at timestamptz,
  risk_level text not null default 'normal',
  ai_interpretation jsonb,
  status text not null default 'pending',
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_note text,
  applied_at timestamptz,
  old_permissions jsonb,
  new_permissions jsonb,
  created_at timestamptz not null default now(),
  constraint chk_ar_kind check (kind in ('feature_access', 'department_assign')),
  constraint chk_ar_scope check (data_scope in ('all', 'own_branch', 'own_shop', 'own_records')),
  constraint chk_ar_duration check (duration in ('today', '7d', '30d', 'custom', 'permanent')),
  constraint chk_ar_risk check (risk_level in ('normal', 'high')),
  constraint chk_ar_status check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint chk_ar_target check ((kind = 'feature_access' and feature_key is not null) or (kind = 'department_assign' and department_key is not null))
);
create index if not exists idx_access_requests_status on access_requests (status, created_at desc);
create index if not exists idx_access_requests_for on access_requests (requested_for, created_at desc);

create table if not exists access_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references access_requests(id) on delete cascade,
  actor_id uuid references profiles(id),
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_access_request_events on access_request_events (request_id, created_at);

comment on table access_requests is 'Ijazat ki darkhwast: AI draft, insaan manzoor, engine lagata hai (270). Kabhi mitti nahi.';
comment on table access_request_events is 'Append-only: kis ne maanga, AI ne kya samjha, kis ne manzoor kiya, purani/nayi ijazat (270).';

alter table access_requests enable row level security;
alter table access_request_events enable row level security;

drop policy if exists access_requests_read on access_requests;
create policy access_requests_read on access_requests for select to authenticated
  using (
    requested_for = auth.uid() or requested_by = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_active and p.role::text in ('owner','super_admin','admin','manager'))
    or exists (select 1 from department_head_grants g where g.profile_id = auth.uid())
  );
drop policy if exists access_requests_insert on access_requests;
create policy access_requests_insert on access_requests for insert to authenticated
  with check (public.fn_is_any_staff() and requested_by = auth.uid());
-- Update sirf service role (lib) se -- faisla wahan capGrant ke sath hota hai.

drop policy if exists access_request_events_read on access_request_events;
create policy access_request_events_read on access_request_events for select to authenticated
  using (exists (select 1 from access_requests r where r.id = request_id));
drop policy if exists access_request_events_insert on access_request_events;
create policy access_request_events_insert on access_request_events for insert to authenticated
  with check (public.fn_is_any_staff() and actor_id = auth.uid());

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active) values
  ('access-requests', 'Ijazat ki Darkhwastein', 'Access Requests', 'اجازت کی درخواستیں', 'Kis ko kya ijazat chahiye: manzoor / radd; kis ke paas kya hai; kaun si khatam ho rahi', 'Who needs which access: approve / reject; who has what; expiring soon', 'کس کو کیا اجازت چاہیے', '/admin/access-requests', 'KeyRound', true, true),
  ('my-access', 'Meri Ijazatein', 'My Access', 'میری اجازتیں', 'Aap ko kya khulta hai, kya maanga hua hai', 'What you can open, what you have requested', 'آپ کو کیا کھلتا ہے', '/admin/my-access', 'KeyRound', false, true)
on conflict (key) do update set route = excluded.route, label = excluded.label, description = excluded.description, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.key, 'access-requests', 92 from dashboards d where d.key in ('admin', 'master')
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, faq, related) values
  ('access-requests', 'rm', 'Staff ki ijazat ki darkhwastein: kis ko kaun sa safha/kaam chahiye, kitni dair ke liye, kyun. Yahan manzoor ya radd; manzoor hote hi ijazat khud lag jati hai aur staff ko paighaam.', 'Owner/Admin sab; Department Head apne department ki, apni ceiling ke andar', 'Roz ek nazar -- ruki hui darkhwast ka matlab ruka hua kaam.',
   array['Pending mein darkhwast kholein: kis ke liye, kya (feature, actions, scope), kab tak, wajah, AI ne kya samjha.', 'Manzoor karein -- jo aap khud nahi rakhte wo aap nahi de sakte (khud kat jata hai).', 'High-risk (finance approval, users/permissions, reversal) sirf Owner/Admin.', '"Kis ke paas kya" aur "khatam ho rahi" tab bhi yahin.'],
   'Manzoori par user_feature_permissions mein qatar; miyaad par khud khatam. Har qadam append-only silsile mein.', array['Bina wajah ke radd.', 'Permanent dena jahan 7 din kaafi the.'], '[]'::jsonb, array['my-access']::text[]),
  ('my-access', 'rm', 'Aap ko kya khulta hai, kis scope mein, kab tak; aap ki darkhwastein; aap ke department. Nayi ijazat Work Coach se maangein: "mujhe stock dekhne ki ijazat chahiye".', 'Har staff', 'Jab koi safha na khule ya naya kaam mile.',
   array['"Meri ijazatein" dekhein.', 'Work Coach ko apne lafzon mein batayein; wo draft dikhayega, "haan" par darkhwast jayegi.', 'Faisla hote hi paighaam.'],
   'Darkhwast approver ke paas; manzoor hote hi safha khul jata hai.', array['Technical naam yaad rakhna -- zaroorat nahi, kaam batayein.'], '[]'::jsonb, array['access-requests']::text[])
on conflict (feature_key, lang) do update set purpose = excluded.purpose, how_steps = excluded.how_steps, updated_at = now();
