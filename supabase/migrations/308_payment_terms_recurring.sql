-- =====================================================================
-- AgriBridge — Migration 308: Adaigi ki shartein, aur har mahine wali entry
-- =====================================================================
-- DO CHEEZEIN:
--
-- 1. ADAIGI KI SHARTEIN (payment terms). Har supplier ki apni shart hoti
--    hai: "15 din", "30 din", "haath ke haath". Ab tak ye har purchase
--    par haath se likhi jati thi -- aur jahan koi bhool jaye wahan
--    `credit_days` aur `due_date` khali reh jate the. Khali due_date ka
--    matlab hai ke wo bill kisi bhi fehrist mein "aaj dena hai" nahi
--    aata, aur adaigi tab yaad aati hai jab supplier khud phone karta
--    hai (Live par abhi ek aisa purchase maujood hai).
--
--    Ab shart supplier par lagti hai, aur purchase par khud utar aati
--    hai. Haath se likhne ka raasta phir bhi khula hai -- likha hua
--    adad hamesha shart par bhari rehta hai.
--
-- 2. HAR MAHINE WALI ENTRY (recurring journal). Kuch entries har mahine
--    wohi hoti hain: dukan ka kiraya, bijli ka anuman, malik ki tankhwah.
--    Ab tak har mahine haath se likhi jati thin, aur jis mahine koi
--    bhool jaye us mahine ka kharcha kam aur nafa zyada dikhta tha.
--
--    Yahan wo ek dafa likhi jati hain aur har mahine EK DABAO par ban
--    jati hain. Khud-ba-khud NAHI banti -- ye jaan boojh kar hai: bina
--    dekhe har mahine ledger mein entry chali jana wo raasta hai jahan
--    band ho chuke kiraye ki entry saal bhar chalti rehti hai aur kisi
--    ko pata nahi chalta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Adaigi ki shartein
-- ---------------------------------------------------------------------
create table if not exists public.payment_terms (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  days int not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.payment_terms drop constraint if exists chk_term_days;
alter table public.payment_terms add constraint chk_term_days check (days >= 0 and days <= 365);

-- Default sirf EK ho sakti hai.
create unique index if not exists uq_payment_term_default
  on public.payment_terms((is_default)) where is_default;

insert into public.payment_terms (name, days, is_default) values
  ('Haath ke haath', 0, true),
  ('7 din', 7, false),
  ('15 din', 15, false),
  ('30 din', 30, false),
  ('45 din', 45, false),
  ('60 din', 60, false)
on conflict (name) do nothing;

alter table public.suppliers add column if not exists payment_term_id uuid references public.payment_terms(id);

-- Purchase par shart khud utar aati hai.
--
-- Sirf tab jab wahan kuch likha HI NA ho. Likha hua adad hamesha bhari
-- rehta hai -- warna kisi din koi shart badal dega aur purane bill ki
-- tareekh chup chaap aage khisak jayegi.
create or replace function public.fn_purchase_terms_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_days int;
begin
  if new.credit_days is null and new.supplier_id is not null then
    select t.days into v_days
      from public.suppliers s
      join public.payment_terms t on t.id = s.payment_term_id
     where s.id = new.supplier_id;

    if v_days is null then
      select days into v_days from public.payment_terms where is_default and is_active;
    end if;

    new.credit_days := v_days;
  end if;

  if new.due_date is null and new.credit_days is not null then
    new.due_date := coalesce(new.purchase_date, current_date) + new.credit_days;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_purchase_terms_default on public.purchases;
create trigger trg_purchase_terms_default
  before insert on public.purchases
  for each row execute function public.fn_purchase_terms_default();

-- ---------------------------------------------------------------------
-- 2. Har mahine wali entry
-- ---------------------------------------------------------------------
create table if not exists public.recurring_journals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text not null,
  -- Mahine ka kaunsa din. 31 rakhne par chhote mahine ka aakhri din.
  day_of_month int not null default 1,
  is_active boolean not null default true,
  -- Kis mahine tak chal chuki -- mahine ka pehla din.
  last_posted_period date,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.recurring_journals drop constraint if exists chk_recurring_day;
alter table public.recurring_journals add constraint chk_recurring_day check (day_of_month between 1 and 31);

alter table public.recurring_journals drop constraint if exists chk_recurring_desc;
alter table public.recurring_journals add constraint chk_recurring_desc
  check (length(btrim(description)) >= 5);

create table if not exists public.recurring_journal_lines (
  id uuid primary key default uuid_generate_v4(),
  recurring_id uuid not null references public.recurring_journals(id) on delete cascade,
  account_code text not null references public.gl_accounts(code),
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  memo text,
  line_order int not null default 1
);

-- Wohi rok jo asal journal par hai: ek qatar mein ek hi taraf.
alter table public.recurring_journal_lines drop constraint if exists chk_recurring_one_side;
alter table public.recurring_journal_lines add constraint chk_recurring_one_side
  check (
    debit >= 0 and credit >= 0
    and (debit = 0 or credit = 0)
    and (debit > 0 or credit > 0)
  );

create index if not exists idx_recurring_lines on public.recurring_journal_lines(recurring_id);

-- Har mahine ek dafa. Ye us ghalti ka taala hai jahan wohi kiraya do
-- dafa chal jata hai aur mahine ka kharcha do guna ho jata hai.
create table if not exists public.recurring_journal_runs (
  id uuid primary key default uuid_generate_v4(),
  recurring_id uuid not null references public.recurring_journals(id) on delete cascade,
  period date not null,
  entry_id uuid not null references public.journal_entries(id),
  posted_by uuid references auth.users(id),
  posted_at timestamptz not null default now(),
  unique (recurring_id, period)
);

alter table public.recurring_journals enable row level security;
alter table public.recurring_journal_lines enable row level security;
alter table public.recurring_journal_runs enable row level security;
alter table public.payment_terms enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['recurring_journals','recurring_journal_lines','recurring_journal_runs','payment_terms'] loop
    execute format('drop policy if exists staff_read_%1$s on public.%1$I', tbl);
    execute format('create policy staff_read_%1$s on public.%1$I for select to authenticated using (public.fn_is_any_staff())', tbl);
    execute format('drop policy if exists finance_write_%1$s on public.%1$I', tbl);
    execute format(
      'create policy finance_write_%1$s on public.%1$I for all to authenticated using (
         exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active
                 and p.role::text in (''owner'',''super_admin'',''admin'',''finance''))
       ) with check (
         exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active
                 and p.role::text in (''owner'',''super_admin'',''admin'',''finance''))
       )', tbl);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Feature, ijazat, menu aur madad
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.recurring', 'Har Mahine Wali Entry', 'Recurring Journals', 'ہر مہینے والی انٹری',
   '/admin/finance/recurring', true, true,
   'Wo entries jo har mahine wohi hoti hain -- kiraya, tankhwah, anuman. Ek dafa likhein, har mahine ek dabao par.'),
  ('finance.terms', 'Adaigi ki Shartein', 'Payment Terms', 'ادائیگی کی شرطیں',
   '/admin/finance/terms', true, false,
   'Kis supplier ko kitne din mein adaigi. Shart supplier par lagti hai aur purchase par khud utar aati hai.')
on conflict (key) do update set
  label        = excluded.label,
  label_en     = excluded.label_en,
  label_ur     = excluded.label_ur,
  route        = excluded.route,
  is_active    = true,
  is_sensitive = excluded.is_sensitive,
  description  = excluded.description;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('finance', 'finance.recurring', array['view','create','edit'], 'all'),
  ('manager', 'finance.terms', array['view'], 'all'),
  ('finance', 'finance.terms', array['view','create','edit'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values
  ('finance', 'finance.recurring', 9, 'Maali Hisaab', 0),
  ('finance', 'finance.terms', 10, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.recurring', 'rm',
  'Wo entries jo har mahine wohi hoti hain: dukan ka kiraya, tankhwah, bijli ka anuman.',
  'Owner, Admin aur Finance.',
  'Mahine ke shuru ya aakhir mein -- jab wo kharcha waqai ho chuka ho.',
  array[
    'Ek dafa entry ka khaka likhein: wajah, khate, aur raqam. Debit aur credit barabar hone chahiyen.',
    'Har mahine safhe par wo khaka "is mahine baqi" mein nazar aata hai.',
    'Dekh kar "Is mahine ki entry banayein" dabayein -- tab entry banti hai.',
    'Ek mahine mein ek hi dafa. Nizam dobara nahi chalne deta.'
  ],
  'Entry ban jane ke baad wo Poora Journal aur us mahine ke goshare mein nazar aati hai.',
  array[
    'Ye samajhna ke entry KHUD ban jayegi. Wo jaan boojh kar khud nahi banti — bina dekhe har mahine ledger mein entry chali jana wo raasta hai jahan band ho chuke kiraye ki entry saal bhar chalti rehti hai.',
    'Khake ko badal kar ye samajhna ke pichhli entries bhi badal gayin. Bani hui entry apni jagah rehti hai; khaka sirf AAGE ke liye badalta hai.',
    'Badalte hue kharche (misal bijli ka asal bill) yahan daal dena. Ye un cheezon ke liye hai jin ka adad har mahine wohi rehta hai.'
  ]
),
(
  'finance.terms', 'rm',
  'Kis supplier ko kitne din mein adaigi karni hai -- aur wo shart purchase par khud utar aati hai.',
  'Owner, Admin aur Finance likhte hain; Manager dekh sakta hai.',
  'Naya supplier banate waqt, ya jab kisi purani shart par baat dobara ho.',
  array[
    'Shart ki fehrist yahan hai: haath ke haath, 15 din, 30 din, waghera.',
    'Har supplier ke saamne us ki shart chunein.',
    'Naya purchase banate waqt din aur adaigi ki tareekh KHUD bhar jate hain.',
    'Purchase par haath se likha hua adad hamesha shart par bhari rehta hai.'
  ],
  'Adaigi ki tareekh bharte hi wo bill "kab dena hai" wali fehrist (Supplier ke Bill) mein aa jata hai.',
  array[
    'Shart badal kar ye samajhna ke purane bill bhi badal gaye. Purane bill par jo tareekh likhi ja chuki wo wohi rehti hai — shart sirf NAYE purchase par lagti hai.',
    'Shart khali chhoR dena. Us surat mein default shart lagti hai, aur agar wo bhi na ho to bill ki koi tareekh nahi banti — aur bina tareekh wala bill kisi fehrist mein "aaj dena hai" nahi aata.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose    = excluded.purpose,
  who_uses   = excluded.who_uses,
  when_use   = excluded.when_use,
  how_steps  = excluded.how_steps,
  next_step  = excluded.next_step,
  mistakes   = excluded.mistakes,
  updated_at = now();
