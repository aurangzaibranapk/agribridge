-- =====================================================================
-- AgriBridge — Migration 306: Budget, aur budget ke saamne asal kharcha
-- =====================================================================
-- Budget ka faida sirf ek hai: mahine ke aakhir mein ye poochha ja sake
-- ke "jitna socha tha, us se zyada to nahi laga". Wo sawal aaj poochha
-- hi nahi ja sakta, kyunki "jitna socha tha" kahin likha hi nahi jata.
--
-- Is liye yahan jaan boojh kar SAADA rakha gaya hai: har khate ka ek
-- SAALANA adad. Bara nizam har khate ka har mahine ka alag adad rakhta
-- hai -- aur us ka nateeja aksar ye hota hai ke koi wo bharta hi nahi,
-- aur budget ka poora hissa khali para rehta hai.
--
-- Muqabla karte waqt saalana adad us arse par baant liya jata hai jitne
-- mahine dekhe ja rahe hain. Ye takreeban hai, aur safhe par SAAF likha
-- hai ke takreeban hai -- kyunki takreeban adad ko pakka keh dena us se
-- bura hai ke adad hi na ho.
-- =====================================================================

create table if not exists public.budgets (
  id uuid primary key default uuid_generate_v4(),
  year int not null,
  name text not null default 'Saalana budget',
  status text not null default 'active',
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (year, name)
);

alter table public.budgets drop constraint if exists chk_budget_year;
alter table public.budgets add constraint chk_budget_year check (year between 2000 and 2100);

alter table public.budgets drop constraint if exists chk_budget_status;
alter table public.budgets add constraint chk_budget_status check (status in ('active', 'archived'));

create table if not exists public.budget_lines (
  id uuid primary key default uuid_generate_v4(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  account_code text not null references public.gl_accounts(code),
  annual_amount numeric(14,2) not null,
  note text,
  updated_at timestamptz not null default now(),
  unique (budget_id, account_code)
);

alter table public.budget_lines drop constraint if exists chk_budget_line_amount;
alter table public.budget_lines add constraint chk_budget_line_amount check (annual_amount >= 0);

create index if not exists idx_budget_lines_budget on public.budget_lines(budget_id);

alter table public.budgets enable row level security;
alter table public.budget_lines enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['budgets','budget_lines'] loop
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

insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.budget', 'Budget', 'Budget', 'بجٹ',
   '/admin/finance/budget', true, true,
   'Har khate ka saalana adad, aur us ke saamne asal kharcha -- taake ye poochha ja sake ke jitna socha tha us se zyada to nahi laga.')
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
  ('manager', 'finance.budget', array['view'], 'all'),
  ('finance', 'finance.budget', array['view','create','edit'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('finance', 'finance.budget', 7, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.budget', 'rm',
  'Har khate ka saalana adad, aur us ke saamne asal kharcha -- taake ye maloom ho ke kis khate par socha hua se zyada laga.',
  'Owner, Admin aur Finance likhte hain; Manager dekh sakta hai.',
  'Saal ke shuru mein adad daalein, aur har mahine ke aakhir mein muqabla dekhein.',
  array[
    'Saal chunein. Har kharche aur aamdani ke khate ke saamne saalana adad likhein.',
    'Jo khata khali chhoR dein us par koi rok nahi lagti -- us ka muqabla bhi nahi dikhta.',
    'Neeche "Budget ke saamne asal" mein tareekh ki hadd chun kar dekhein.',
    'Saalana adad us arse par baant liya jata hai -- ye TAKREEBAN muqabla hai, aur wahan likha bhi hai.'
  ],
  'Jis khate par farq bara ho, us ki tafseel Maali Gosharay ke "Poora Journal" par dekhi ja sakti hai.',
  array[
    'Har khate ka budget bharne ki koshish. Sirf un khaton par likhein jin par waqai nazar rakhni hai — baqi par likha hua adad sirf shor banata hai.',
    'Takreeban muqable ko pakka samajh lena. Saalana adad barabar mahinon mein baanta jata hai; asal kharcha mausam ke sath uupar neeche hota hai (misal: kattai ke mahinon mein diesel zyada).',
    'Budget ko rok samajh lena. Ye kisi kharche ko rokta nahi — ye sirf batata hai.'
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
