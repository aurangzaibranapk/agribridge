-- Al Rana Traders: Khata statement sharing + recovery foundation.
create table if not exists public.statement_share_history (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  branch_id uuid references public.branches(id),
  shop_id uuid,
  party_type text not null,
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
  party_type text not null,
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
  party_type text not null,
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

create index if not exists idx_statement_share_party on public.statement_share_history(party_type, party_id, created_at desc);
create index if not exists idx_payment_reminders_due on public.payment_reminders(delivery_status, scheduled_at);
create index if not exists idx_payment_promises_due on public.payment_promises(status, promise_date);
create unique index if not exists uq_active_scheduled_reminder
  on public.payment_reminders(party_type, party_id, channel, reminder_stage, scheduled_at)
  where delivery_status in ('draft','scheduled','pending');

alter table public.statement_share_history enable row level security;
alter table public.payment_reminders enable row level security;
alter table public.payment_promises enable row level security;

drop policy if exists staff_statement_share_history on public.statement_share_history;
create policy staff_statement_share_history on public.statement_share_history for all to authenticated
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
drop policy if exists staff_payment_reminders on public.payment_reminders;
create policy staff_payment_reminders on public.payment_reminders for all to authenticated
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());
drop policy if exists staff_payment_promises on public.payment_promises;
create policy staff_payment_promises on public.payment_promises for all to authenticated
  using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

insert into storage.buckets (id, name, public)
values ('statement-files', 'statement-files', true)
on conflict (id) do update set public = true;

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
