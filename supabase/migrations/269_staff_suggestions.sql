-- =====================================================================
-- AgriBridge — Migration 269: Staff ki tajweezein (Improvements Center)
-- =====================================================================
-- Guided ERP ka qadam F (malik ka nukta, 2 September):
-- "Staff ERP ko sirf use nahi karega -- staff ki feedback se ERP
-- continuously improve bhi hoga."
--
-- Staff apni baat Work Coach ko kehta hai ("stock receiving mein
-- barcode scan hona chahiye"); AI us se tajweez ka draft banata hai
-- (department, feature, qism, masla, behtari, priority), staff tasdeeq
-- karta hai, tab yahan darj hoti hai. Number SUG-2026-00001.
--
-- AI capture -> structure -> classify -> duplicate ka shak -> sifarish
-- tak. Manzoori aur amal admin ka kaam hai; AI kabhi khud kuch nahi
-- badalta.
--
-- Duplicate: asal qatarein kabhi nahi mitti -- doosri qatar
-- 'duplicate' hoti hai aur duplicate_of se asal se juRti hai; ginti
-- "ye masla N logon ne bataya" isi se banti hai. Saboot zaya nahi hota.
-- =====================================================================

create sequence if not exists suggestion_seq start 1;

create or replace function fn_next_suggestion_number()
returns text language sql as $$
  select 'SUG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('suggestion_seq')::text, 5, '0');
$$;

create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default fn_next_suggestion_number(),
  submitted_by uuid references profiles(id),
  department_key text,
  feature_key text references features(key) on delete set null,
  page_route text,
  category text not null default 'other',
  title text not null,
  problem text,
  improvement text,
  priority text not null default 'medium',
  status text not null default 'new',
  duplicate_of uuid references suggestions(id),
  evidence_url text,
  ai_raw jsonb,
  implemented_version text,
  implemented_at timestamptz,
  related_link text,
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_suggestion_category check (category in (
    'new_feature','improvement','process_problem','ui_ux','bug','automation','ai_improvement','report','training_help','other')),
  constraint chk_suggestion_priority check (priority in ('low','medium','high')),
  constraint chk_suggestion_status check (status in (
    'new','under_review','accepted','planned','in_development','implemented','rejected','duplicate')),
  constraint chk_suggestion_dup check (status <> 'duplicate' or duplicate_of is not null)
);

create index if not exists idx_suggestions_status on suggestions (status, created_at desc);
create index if not exists idx_suggestions_dept on suggestions (department_key, status);
create index if not exists idx_suggestions_dup on suggestions (duplicate_of) where duplicate_of is not null;

create table if not exists suggestion_comments (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  author_id uuid references profiles(id),
  kind text not null default 'comment',
  body text not null,
  created_at timestamptz not null default now(),
  constraint chk_sug_comment_kind check (kind in ('comment','status','duplicate','implemented'))
);
create index if not exists idx_suggestion_comments on suggestion_comments (suggestion_id, created_at);

comment on table suggestions is 'Staff ki tajweezein aur masle -- Improvements Center (269). Kabhi mitti nahi; duplicate asal se juRti hai.';

alter table suggestions enable row level security;
alter table suggestion_comments enable row level security;

-- Reviewer: Owner/Admin sab; Manager sab; baqi apna department aur apni.
create or replace function fn_can_review_suggestions()
returns boolean language sql stable as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.is_active
                 and p.role::text in ('owner','super_admin','admin','manager'));
$$;

drop policy if exists suggestions_read on suggestions;
create policy suggestions_read on suggestions for select to authenticated
  using (
    fn_can_review_suggestions()
    or submitted_by = auth.uid()
    or (public.fn_is_any_staff() and department_key is not null and department_key = (
      select case p.role::text
        when 'sales_staff' then 'sales' when 'finance' then 'finance' when 'warehouse' then 'warehouse'
        when 'procurement' then 'procurement' when 'milk_collection' then 'dairy' when 'machinery' then 'machinery'
        when 'hr' then 'hr' when 'admin_assistant' then 'admin_office' when 'manager' then 'manager' else null end
      from profiles p where p.id = auth.uid()))
  );
drop policy if exists suggestions_insert on suggestions;
create policy suggestions_insert on suggestions for insert to authenticated
  with check (public.fn_is_any_staff() and submitted_by = auth.uid());
drop policy if exists suggestions_update on suggestions;
create policy suggestions_update on suggestions for update to authenticated
  using (fn_can_review_suggestions()) with check (fn_can_review_suggestions());

drop policy if exists suggestion_comments_read on suggestion_comments;
create policy suggestion_comments_read on suggestion_comments for select to authenticated
  using (exists (select 1 from suggestions s where s.id = suggestion_id));
drop policy if exists suggestion_comments_insert on suggestion_comments;
create policy suggestion_comments_insert on suggestion_comments for insert to authenticated
  with check (public.fn_is_any_staff() and author_id = auth.uid() and exists (select 1 from suggestions s where s.id = suggestion_id));

-- Ginti: har halat mein kitni, aur "kitne logon ne bataya" (asal + duplicates)
drop view if exists v_suggestion_report_counts;
create view v_suggestion_report_counts as
select s.id as suggestion_id,
       1 + (select count(*) from suggestions d where d.duplicate_of = s.id) as reported_by
from suggestions s
where s.status <> 'duplicate';

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active) values
  ('improvements', 'Tajweezein (Improvements)', 'Improvements Center', 'تجاویز', 'Staff ki tajweezein aur masle: nayi, jaanch mein, manzoor, ban rahi, ban gayi', 'Staff suggestions and problems: new, under review, accepted, in development, implemented', 'اسٹاف کی تجاویز اور مسائل', '/admin/improvements', 'Lightbulb', true, true)
on conflict (key) do update set route = excluded.route, label = excluded.label, description = excluded.description, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order)
select d.key, 'improvements', 91 from dashboards d where d.key in ('admin', 'master')
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, faq, related) values
  ('improvements', 'rm', 'Staff ki tajweezein aur masle ek jagah: kaun si nayi, kaun si jaanch mein, manzoor, ban rahi, ban gayi, radd ya duplicate. Har tajweez ka number (SUG-2026-00001) aur poori baat mehfooz.', 'Staff apni tajweez dete hain (Work Coach mein 💡); Owner/Admin/Manager jaanch aur faisla', 'Roz ek nazar; hafte mein faisle.',
   array['Staff Work Coach ko batata hai: "receiving mein barcode scan hona chahiye" -- AI draft banata hai, staff tasdeeq karta hai.', 'Yahan nayi tajweezein upar; kholein, halat badlein (jaanch mein / manzoor / plan / ban rahi / ban gayi / radd).', 'Ek hi masla kai logon ne bataya ho to doosri ko "duplicate" karein -- asal se juRti hai, ginti "N logon ne bataya" dikhti hai.', 'Ban jaye to version/tareekh aur link likhein; staff ko khud paighaam jata hai.'],
   'Jo tajweez sab se zyada logon ne di, wo agli development ki tarjeeh.', array['Tajweez mitana -- kabhi nahi; radd ya duplicate karein.', 'Bina jawab ke chhoR dena -- staff dobara nahi batayega.'], '[]'::jsonb, array['my-work','bridge-ai']::text[]),
  ('improvements', 'en', 'Staff suggestions and problems in one place with a number (SUG-2026-00001) and full history. Reviewers move them through review, accepted, planned, in development, implemented, rejected or duplicate.', 'Staff submit via the Work Coach (💡); Owner/Admin/Manager review', 'Daily glance; weekly decisions.',
   array['Staff tell the Work Coach; AI drafts, staff confirm.', 'Open a suggestion, change its status.', 'Mark repeats as duplicate of the original -- the count "reported by N" grows.', 'On implementation record version/date and link; the submitter is notified.'],
   'The most-reported suggestion is the next priority.', array['Deleting a suggestion -- never; reject or mark duplicate.'], '[]'::jsonb, array['my-work','bridge-ai']::text[])
on conflict (feature_key, lang) do update set purpose = excluded.purpose, how_steps = excluded.how_steps, updated_at = now();
