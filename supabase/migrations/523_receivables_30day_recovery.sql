-- 523: Udhaar ki 30 din ki hadd, WhatsApp yaad-dihani (15/30 din) aur aging.
--
-- Malik (10 October 2026): "jis jis se hum ne paisa lena hai sab ke due
-- 15 din par reminder aaye aur late se late 30 din, is se ziyada hamara
-- due nahi hona chahiye -- recovery fast karni hai."
--
-- Sirf NAYA: koi purana table/function/column nahi badla ya hataya.
--
-- Aging ka hisaab: ledger (1100, party_type customer) se, FIFO -- gahak ki
-- har wapsi (credit) sab se purane udhaar (debit) ko pehle chukati hai.
-- Jo debit abhi tak poora nahi chuka, us ki tareekh se din gine jate hain.

-- 1) Settings (ek hi row)
create table if not exists public.receivable_recovery_settings (
  id boolean primary key default true check (id),
  due_days integer not null default 30 check (due_days between 1 and 365),
  reminder_day integer not null default 15 check (reminder_day between 1 and 365),
  final_notice_day integer not null default 30 check (final_notice_day between 1 and 365),
  -- 30 din se purana baqaya ho to naya udhaar band (Admin override ke sath)
  block_overdue_credit boolean not null default true,
  -- Naye gahak ke liye aam hadd (NULL = koi aam hadd nahi; gahak ki apni
  -- credit_limit pehle ki tarah chalti hai)
  default_credit_limit numeric check (default_credit_limit is null or default_credit_limit >= 0),
  -- Is se kam baqaya par na rok, na yaad-dihani
  min_amount numeric not null default 100,
  -- WhatsApp yaad-dihani: BAND by default. Malik go-live ke baad khud chalu karein.
  reminders_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.receivable_recovery_settings (id) values (true) on conflict (id) do nothing;

-- 2) Har gahak ki yaad-dihani ki marzi (pause / skip)
create table if not exists public.receivable_reminder_prefs (
  customer_id uuid primary key references public.customers(id),
  paused boolean not null default false,
  skip_until date,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- 3) Yaad-dihani ki qatar: har stage ek dafa (cycle = sab se purane
--    na-chuke udhaar ki tareekh)
create table if not exists public.receivable_reminders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  stage text not null check (stage in ('day15','day30')),
  cycle_date date not null,
  amount_due numeric not null,
  due_date date not null,
  shop_name text,
  phone text,
  message text,
  status text not null default 'pending'
    check (status in ('pending','sent','failed','skipped')),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint receivable_reminders_once unique (customer_id, stage, cycle_date)
);
create index if not exists idx_receivable_reminders_status on public.receivable_reminders(status, created_at);

-- 4) Override log: 30 din wali rok kis ne, kab, kyun kholi
create table if not exists public.credit_block_overrides (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  context text not null,           -- 'pos' | 'customer_udhaar' | ...
  amount numeric,
  overdue_amount numeric,
  oldest_days integer,
  reason text not null check (length(trim(reason)) >= 3),
  overridden_by uuid,
  overridden_role text,
  created_at timestamptz not null default now()
);

alter table public.receivable_recovery_settings enable row level security;
alter table public.receivable_reminder_prefs enable row level security;
alter table public.receivable_reminders enable row level security;
alter table public.credit_block_overrides enable row level security;

do $$
declare t text;
begin
  foreach t in array array['receivable_recovery_settings','receivable_reminder_prefs','receivable_reminders','credit_block_overrides'] loop
    execute format('drop policy if exists %I on public.%I', 'Owner/Admin can view '||t, t);
    execute format('create policy %I on public.%I for select using (fn_has_dept(array[''owner'',''super_admin'',''admin'']::public.user_role[]))', 'Owner/Admin can view '||t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- 5) Aging: har gahak ka baqaya, FIFO ke mutabiq buckets
create or replace function public.fn_customer_receivable_aging(
  p_as_of date default null,
  p_customer uuid default null
)
returns table (
  customer_id uuid,
  balance numeric,
  oldest_unpaid_date date,
  oldest_days integer,
  due_date date,
  bucket_0_15 numeric,
  bucket_15_30 numeric,
  bucket_30_plus numeric,
  last_branch_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with asof as (
    select coalesce(p_as_of, (now() at time zone 'Asia/Karachi')::date) as d
  ),
  lines as (
    select l.party_id as cid, e.entry_date, e.entry_number, e.branch_id,
           coalesce(l.debit,0) as dr, coalesce(l.credit,0) as cr
      from journal_lines l
      join journal_entries e on e.id = l.entry_id
     where l.account_code = '1100'
       and l.party_type = 'customer'
       and l.party_id is not null
       and (p_customer is null or l.party_id = p_customer)
       and e.entry_date <= (select d from asof)
  ),
  credits as (
    select cid, sum(cr) as total_cr from lines group by cid
  ),
  debits as (
    select d.cid, d.entry_date, d.dr, d.branch_id,
           sum(d.dr) over (partition by d.cid order by d.entry_date, d.entry_number
                           rows between unbounded preceding and current row) as cum
      from lines d where d.dr > 0
  ),
  open_debits as (
    select d.cid, d.entry_date, d.branch_id,
           greatest(0, least(d.dr, d.cum - coalesce(c.total_cr,0))) as open_amt
      from debits d left join credits c on c.cid = d.cid
  ),
  agg as (
    select o.cid,
           min(o.entry_date) filter (where o.open_amt > 0.009) as oldest,
           sum(o.open_amt) filter (where (select d from asof) - o.entry_date < 15) as b1,
           sum(o.open_amt) filter (where (select d from asof) - o.entry_date between 15 and 29) as b2,
           sum(o.open_amt) filter (where (select d from asof) - o.entry_date >= 30) as b3
      from open_debits o group by o.cid
  ),
  bal as (
    select cid, round(sum(dr - cr), 2) as balance from lines group by cid
  )
  select b.cid,
         b.balance,
         a.oldest,
         ((select d from asof) - a.oldest)::integer,
         a.oldest + (select due_days from receivable_recovery_settings where id),
         round(coalesce(a.b1,0),2), round(coalesce(a.b2,0),2), round(coalesce(a.b3,0),2),
         (select o.branch_id from open_debits o where o.cid = b.cid and o.open_amt > 0.009
           order by o.entry_date desc limit 1)
    from bal b join agg a on a.cid = b.cid
   where (fn_is_any_staff() or auth.role() = 'service_role')
     and b.balance > 0.009
     and a.oldest is not null;
$$;

comment on function public.fn_customer_receivable_aging(date, uuid) is
  'Gahak ka baqaya FIFO aging (0-15, 15-30, 30+) ledger 1100 se. Due date = sab se purana na-chuka udhaar + due_days (523).';

grant execute on function public.fn_customer_receivable_aging(date, uuid) to authenticated, service_role;

-- 6) Admin safhaat
insert into features (key, label, label_en, label_ur, route, icon, is_sensitive, description, is_active)
values
  ('finance.receivable_aging', 'Udhaar Aging (0-15/15-30/30+)', 'Receivables Aging', 'Udhaar Aging',
   '/admin/receivable-aging', 'Clock', true,
   'Har gahak ka baqaya umar ke hisaab se: 0-15, 15-30 aur 30+ din.', true),
  ('system.receivable_reminders', 'Wasooli WhatsApp Yaad-dihani', 'Recovery Reminders', 'Wasooli Yaad-dihani',
   '/admin/receivable-reminders', 'BellRing', true,
   '15 din par yaad-dihani, 30 din par aakhri notice -- settings, pause aur skip.', true)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, description = excluded.description, is_active = true;

insert into role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('admin', 'finance.receivable_aging', array['view']::text[], 'all'),
  ('owner', 'finance.receivable_aging', array['view']::text[], 'all'),
  ('super_admin', 'finance.receivable_aging', array['view']::text[], 'all'),
  ('admin', 'system.receivable_reminders', array['view','edit']::text[], 'all'),
  ('owner', 'system.receivable_reminders', array['view','edit']::text[], 'all'),
  ('super_admin', 'system.receivable_reminders', array['view','edit']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
