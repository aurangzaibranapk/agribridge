-- =====================================================================
-- AgriBridge — Migration 305: Hisaab ke arse, aur mahina/saal band karna
-- =====================================================================
-- Ab tak nizam mein KISI bhi guzri hui tareekh par entry daali ja sakti
-- thi. Journal Entry par us ki wajah maangi jati hai aur audit par
-- nishaan lagta hai (106) -- magar rok koi nahi thi.
--
-- Ye us waqt tak chalta hai jab tak kisi ne wo mahina "band" na kar
-- diya ho. Band karne ka matlab hi ye hai ke us arse ke adad ab pathar
-- hain: goshara chhap chuka, malik ne dekh liya, faisle us par ho chuke.
-- Us ke baad wahan ek entry aur chali jaye to har wo kaghaz jhoota ho
-- jata hai jo pehle nikala ja chuka -- aur ye kisi ko nazar bhi nahi
-- aata, kyunki nizam har dafa naya adad dikha deta hai.
--
-- Is liye do cheezein yahan aa rahi hain:
--
--   1. ARSE KI FEHRIST (`accounting_periods`) -- har mahina khula ya
--      band.
--   2. DATABASE KI ROK -- band mahine mein na nayi entry ja sakti hai,
--      na purani badal sakti hai. Rok code mein nahi, yahan hai: koi
--      bhi raasta ho, band arse mein entry andar nahi jayegi.
--
-- Ghalti ki durusti ka raasta phir bhi khula rehta hai: mahina dobara
-- KHOLA ja sakta hai (wajah ke sath, aur wo audit par likha jata hai).
-- Bandish ka maqsad rokna nahi, NAZAR MEIN LANA hai.
-- =====================================================================

create table if not exists public.accounting_periods (
  id uuid primary key default uuid_generate_v4(),
  period date not null unique,
  status text not null default 'open',
  -- Saal band karne wali entry -- sirf us mahine par jis mein saal khatam hua.
  closing_entry_id uuid references public.journal_entries(id),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  reopened_by uuid references auth.users(id),
  reopened_at timestamptz,
  reopen_reason text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.accounting_periods drop constraint if exists chk_period_status;
alter table public.accounting_periods add constraint chk_period_status
  check (status in ('open', 'closed'));

alter table public.accounting_periods drop constraint if exists chk_period_first_day;
alter table public.accounting_periods add constraint chk_period_first_day
  check (period = date_trunc('month', period)::date);

alter table public.accounting_periods drop constraint if exists chk_period_closed;
alter table public.accounting_periods add constraint chk_period_closed
  check ((status = 'closed') = (closed_at is not null));

-- Dobara kholne ki wajah lazmi -- yehi wo jagah hai jahan se band kiya
-- hua hisaab dobara badla ja sakta hai.
alter table public.accounting_periods drop constraint if exists chk_period_reopen_reason;
alter table public.accounting_periods add constraint chk_period_reopen_reason
  check (reopened_at is null or (reopen_reason is not null and length(btrim(reopen_reason)) >= 10));

create index if not exists idx_period_status on public.accounting_periods(status);

-- ---------------------------------------------------------------------
-- Rok: band arse mein entry nahi
-- ---------------------------------------------------------------------
create or replace function public.fn_period_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_period date;
begin
  v_period := date_trunc('month', new.entry_date)::date;
  select status into v_status from public.accounting_periods where period = v_period;

  if v_status = 'closed' then
    raise exception 'Ye mahina (%) band ho chuka hai. Band arse mein nayi entry nahi jati — pehle wo mahina dobara kholna hoga (wajah ke sath).',
      to_char(v_period, 'Mon YYYY');
  end if;

  -- Purani entry ki tareekh badal kar band mahine mein le jane ka
  -- raasta bhi wahi raasta hai.
  if tg_op = 'UPDATE' and old.entry_date is distinct from new.entry_date then
    select status into v_status from public.accounting_periods
     where period = date_trunc('month', old.entry_date)::date;
    if v_status = 'closed' then
      raise exception 'Ye entry band mahine (%) ki hai — us ki tareekh nahi badalti.',
        to_char(date_trunc('month', old.entry_date)::date, 'Mon YYYY');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_period_lock on public.journal_entries;
create trigger trg_period_lock
  before insert or update on public.journal_entries
  for each row execute function public.fn_period_lock();

-- ---------------------------------------------------------------------
-- Ijazat ki rok
-- ---------------------------------------------------------------------
alter table public.accounting_periods enable row level security;

drop policy if exists staff_read_periods on public.accounting_periods;
create policy staff_read_periods on public.accounting_periods
  for select to authenticated using (public.fn_is_any_staff());

drop policy if exists finance_write_periods on public.accounting_periods;
create policy finance_write_periods on public.accounting_periods
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active
            and p.role::text in ('owner','super_admin','admin','finance'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active
            and p.role::text in ('owner','super_admin','admin','finance'))
  );

-- ---------------------------------------------------------------------
-- Feature, ijazat, menu aur madad
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.periods', 'Hisaab ke Arse', 'Accounting Periods', 'حساب کے عرصے',
   '/admin/finance/periods', true, true,
   'Har mahina khula ya band. Band mahine mein koi nayi entry nahi jati -- na kisi safhe se, na haath se.')
on conflict (key) do update set
  label        = excluded.label,
  label_en     = excluded.label_en,
  label_ur     = excluded.label_ur,
  route        = excluded.route,
  is_active    = true,
  is_sensitive = excluded.is_sensitive,
  description  = excluded.description;

-- Mahina band karna aur kholna sirf finance ke haath mein. Manager dekh
-- sakta hai ke kaunsa mahina band hai (us ka apna kaam us par rukta
-- hai), magar band ya khol nahi sakta.
insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager', 'finance.periods', array['view'], 'all'),
  ('finance', 'finance.periods', array['view','create','edit'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('finance', 'finance.periods', 6, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.periods', 'rm',
  'Har mahina khula hai ya band. Band mahine ke adad pathar hain -- un mein koi nayi entry nahi jati.',
  'Owner, Admin aur Finance band/khol sakte hain; Manager sirf dekh sakta hai.',
  'Jab mahine ka hisaab mil chuke aur goshara dekh liya jaye -- tab wo mahina band karein.',
  array[
    'Pehle us mahine ke gosharay dekhein (Trial Balance barabar hona chahiye).',
    'Us mahine ki depreciation chal chuki ho, aur cash ki ginti bhi ho chuki ho.',
    'Phir "Band karein" dabayein. Us ke baad us mahine mein koi entry nahi jayegi.',
    'Saal ka aakhri mahina band karte waqt "saal band karein" bhi chalayein -- us se nafa nuqsan ke khate sarmaye mein chale jate hain.'
  ],
  'Band karne ke baad agla mahina khula rehta hai aur rozana ka kaam waise hi chalta rehta hai.',
  array[
    'Mahina band kar ke bhool jana ke us mein kuch reh gaya tha. Band mahine mein entry rok di jati hai — us surat mein mahina DOBARA kholna parta hai, aur us ki wajah likhni parti hai.',
    'Mahina bina goshara dekhe band kar dena. Bandish ka faida tabhi hai jab andar ke adad dekh liye gaye hon.',
    'Ye samajhna ke band karne se koi cheez mit jati hai. Kuch nahi mitta — bas naye indraj ka darwaza band hota hai.'
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
