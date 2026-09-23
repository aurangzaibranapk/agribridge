-- Al Rana Traders: Khata statement sharing + recovery foundation.
--
-- (Asal number 385 tha; is deploy branch par wo number pehle se kisi
-- aur migration ka hai, is liye yahan 395 par le aaya gaya -- number
-- sirf faisla hai ke file kis tarteeb mein chalti hai, iska matlab wahi
-- hai.)
create table if not exists public.statement_share_history (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  branch_id uuid references public.branches(id),
  shop_id uuid,
  party_type text not null check (party_type in ('customer','farmer','dealer','supplier')),
  party_id uuid not null,
  khata_account_id uuid,
  statement_from_date date,
  statement_to_date date,
  opening_balance numeric(14,2) not null default 0,
  closing_balance numeric(14,2) not null default 0,
  document_url text,
  document_format text not null default 'pdf',
  channel text not null check (channel in ('whatsapp','email','sms','download','print')),
  recipient text,
  delivery_status text not null default 'pending',
  external_message_id text,
  sent_by uuid references public.profiles(id),
  sent_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_reminders (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  branch_id uuid references public.branches(id),
  shop_id uuid,
  party_type text not null check (party_type in ('customer','farmer','dealer','supplier')),
  party_id uuid not null,
  khata_account_id uuid,
  outstanding_amount numeric(14,2) not null default 0,
  overdue_amount numeric(14,2) not null default 0,
  due_date date,
  reminder_stage text not null default 'friendly',
  channel text not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivery_status text not null default 'draft',
  external_message_id text,
  sent_by uuid references public.profiles(id),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_promises (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  branch_id uuid references public.branches(id),
  shop_id uuid,
  party_type text not null check (party_type in ('customer','farmer','dealer','supplier')),
  party_id uuid not null,
  promised_amount numeric(14,2) not null check (promised_amount > 0),
  promise_date date not null,
  status text not null default 'open',
  notes text,
  assigned_to uuid references public.profiles(id),
  fulfilled_amount numeric(14,2) not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  template_name text not null,
  language text not null default 'roman_urdu',
  channel text not null default 'whatsapp',
  message_body text not null,
  reminder_stage text not null default 'friendly',
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, template_name, language, channel)
);

create table if not exists public.recovery_followups (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  branch_id uuid references public.branches(id),
  shop_id uuid,
  party_type text not null check (party_type in ('customer','farmer','dealer','supplier')),
  party_id uuid not null,
  assigned_staff_id uuid references public.profiles(id),
  followup_date date not null,
  action_type text not null,
  result text,
  next_action_date date,
  notes text,
  attachment_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_settings (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  branch_id uuid references public.branches(id),
  shop_id uuid,
  sending_hours jsonb not null default '{"from":"09:00","to":"18:00"}'::jsonb,
  daily_limit integer not null default 200,
  duplicate_block_hours integer not null default 24,
  default_language text not null default 'roman_urdu',
  auto_stop_on_payment boolean not null default true,
  escalation_rules jsonb not null default '{"3":"whatsapp","7":"staff_task","15":"manager_alert","30":"high_risk"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Testing par ye tables pehle hi (asal 385 ke, bina check-constraint
-- wale) run se ban chuke hain -- "create table if not exists" un ko
-- ab nahi chhuta. Is liye check yahan alag se, aur agar pehle se maujood
-- ho to chup chaap chhoR dete hain.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'statement_share_history_party_type_check') then
    alter table public.statement_share_history add constraint statement_share_history_party_type_check
      check (party_type in ('customer','farmer','dealer','supplier'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payment_reminders_party_type_check') then
    alter table public.payment_reminders add constraint payment_reminders_party_type_check
      check (party_type in ('customer','farmer','dealer','supplier'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payment_promises_party_type_check') then
    alter table public.payment_promises add constraint payment_promises_party_type_check
      check (party_type in ('customer','farmer','dealer','supplier'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recovery_followups_party_type_check') then
    alter table public.recovery_followups add constraint recovery_followups_party_type_check
      check (party_type in ('customer','farmer','dealer','supplier'));
  end if;
end $$;

create index if not exists idx_statement_share_party on public.statement_share_history(party_type, party_id, created_at desc);
create index if not exists idx_payment_reminders_due on public.payment_reminders(delivery_status, scheduled_at);
create index if not exists idx_payment_promises_due on public.payment_promises(status, promise_date);
create unique index if not exists uq_active_scheduled_reminder
  on public.payment_reminders(party_type, party_id, channel, reminder_stage, scheduled_at)
  where delivery_status in ('draft','scheduled','pending');

alter table public.statement_share_history enable row level security;
alter table public.payment_reminders enable row level security;
alter table public.payment_promises enable row level security;
alter table public.reminder_templates enable row level security;
alter table public.recovery_followups enable row level security;
alter table public.reminder_settings enable row level security;

drop policy if exists staff_statement_share_history on public.statement_share_history;
create policy staff_statement_share_history on public.statement_share_history for all to authenticated
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
drop policy if exists staff_payment_reminders on public.payment_reminders;
create policy staff_payment_reminders on public.payment_reminders for all to authenticated
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
drop policy if exists staff_payment_promises on public.payment_promises;
create policy staff_payment_promises on public.payment_promises for all to authenticated
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
drop policy if exists staff_reminder_templates on public.reminder_templates;
create policy staff_reminder_templates on public.reminder_templates for all to authenticated
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
drop policy if exists staff_recovery_followups on public.recovery_followups;
create policy staff_recovery_followups on public.recovery_followups for all to authenticated
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
drop policy if exists staff_reminder_settings on public.reminder_settings;
create policy staff_reminder_settings on public.reminder_settings for all to authenticated
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

insert into public.reminder_templates (template_name, language, channel, message_body, reminder_stage, is_default)
values
  ('Friendly Reminder', 'roman_urdu', 'whatsapp', 'Assalam-o-Alaikum {{party_name}} Sahib, Al Rana Traders ke record ke mutabiq Rs {{outstanding_amount}} outstanding hain. Due date: {{due_date}}. Meherbani farma kar payment jama karwa dein.', 'friendly', true),
  ('Overdue Reminder', 'roman_urdu', 'whatsapp', 'Assalam-o-Alaikum {{party_name}} Sahib, aap ki Rs {{outstanding_amount}} payment overdue hai. Payment clear kar dein ya expected payment date confirm karein. Al Rana Traders 0312-6513294', 'overdue', true)
on conflict do nothing;

-- Jo staff nahi, us ke liye khali fehrist NAHI dete -- warna "Total
-- Receivable Rs 0" jhoot bol deta, wahi ghalti jo is project mein
-- "khali jawab = sifar" maan lene se pehle bhi ho chuki hai. Us banda
-- ke liye ye function sirf saaf mana karta hai.
create or replace function public.fn_recovery_outstanding(p_search text default null)
returns table (
  party_type text, party_id uuid, party_name text, phone text, email text,
  outstanding numeric, last_activity date
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not fn_is_any_staff() then
    raise exception 'Recovery dekhne ki ijazat nahi.';
  end if;
  return query
  with balances as (
    select l.party_type, l.party_id,
           round(sum(coalesce(l.debit,0) - coalesce(l.credit,0)),2) outstanding,
           max(e.entry_date) last_activity
    from journal_lines l join journal_entries e on e.id=l.entry_id
    where l.party_id is not null
      and l.party_type in ('customer','farmer','dealer','supplier')
    group by l.party_type,l.party_id
    having sum(coalesce(l.debit,0) - coalesce(l.credit,0)) > 0
  ), parties as (
    select 'customer'::text party_type,id party_id,name party_name,phone_number phone,email from customers where coalesce(is_deleted,false)=false
    union all select 'farmer',id,coalesce(full_name,'Farmer'),coalesce(whatsapp_number,phone_number),email from farmers
    union all select 'dealer',id,business_name,phone_number,null::text from dealers
    union all select 'supplier',id,name,phone_number,null::text from suppliers
  )
  select b.party_type,b.party_id,p.party_name,p.phone,p.email,b.outstanding,b.last_activity
  from balances b join parties p using(party_type,party_id)
  where p_search is null or p.party_name ilike '%'||p_search||'%' or coalesce(p.phone,'') ilike '%'||p_search||'%'
  order by b.outstanding desc;
end;
$$;
grant execute on function public.fn_recovery_outstanding(text) to authenticated;

create or replace function public.fn_stop_paid_party_reminders()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.account_code='1100' and new.credit>0 and new.party_id is not null then
    update payment_reminders set delivery_status='stopped_after_payment',updated_at=now()
    where party_type=new.party_type and party_id=new.party_id
      and delivery_status in ('draft','scheduled','pending')
      and outstanding_amount <= new.credit;
  end if;
  return new;
end $$;
drop trigger if exists trg_stop_paid_party_reminders on public.journal_lines;
create trigger trg_stop_paid_party_reminders after insert on public.journal_lines
for each row execute function public.fn_stop_paid_party_reminders();

insert into storage.buckets (id, name, public)
values ('statement-files', 'statement-files', false)
on conflict (id) do update set public = false;

insert into public.features
  (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values
  ('finance.recovery', 'Khata & Recovery', 'Khata & Recovery', 'کھاتہ اور وصولی',
   '/admin/finance/recovery', 'HandCoins', true,
   'Outstanding, statement aur reminder', 'Outstanding accounts, statements and reminders',
   'بقایا کھاتے، اسٹیٹمنٹ اور یاد دہانی', true)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, description = excluded.description,
  description_en = excluded.description_en, description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('finance', 'finance.recovery', 15, 'Finance & Ledger', 3)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order, section = excluded.section, section_order = excluded.section_order;
