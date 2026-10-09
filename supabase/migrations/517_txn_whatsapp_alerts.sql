-- 517: Har len-den (Rs 1,000 se upar) par malik ko WhatsApp alert.
--
-- Malik (9 October 2026): "koi bhi payment aaye, jaye, udhaar ho ya
-- recovery ho, Rs 1,000 se upar har transaction ka mujhe WhatsApp par
-- bank ke message ki tarah paighaam mile." Paid Utility template ki
-- ijazat di (txn_alert), POS sale aur shift close ko chhor kar.
--
-- Pakarne ki jagah: journal (ledger). Har module (udhaar, recovery,
-- load bill, supplier payment, bank/cash transfer, machinery, grain ...)
-- akhir mein journal_entries + journal_lines likhta hai. Is liye ek hi
-- jagah se SAB pakRe jate hain.
--
-- Do dafa paighaam nahi: qatar (txn_whatsapp_alerts) mein entry_id
-- UNIQUE hai. Ek entry = ek paighaam. Bank -> bank transfer ki do lines
-- hoti hain magar paighaam ek ("UBL -> Alfalah").
--
-- Trigger DEFERRED hai (trg_journal_balance ki tarah): save mukammal
-- hone (COMMIT) par chalta hai, jab entry ki saari lines maujood hoti
-- hain -- is liye raqam, account aur party poori milti hai.
--
-- Bhejna: /api/cron/txn-alerts (cPanel cron har minute). Agar
-- WHATSAPP_TXN_TEMPLATE set nahi to route kuch nahi bhejta, qatarein
-- "pending" rehti hain. Purani (max_age_hours se zyada) qatarein bhejne
-- ke bajaye "skipped" hoti hain taa ke template lagte hi purana dher na
-- aa jaye.
--
-- Sirf naya: koi purana function/trigger/table nahi badla.

-- ---------------------------------------------------------------------
-- 1) Settings (ek hi row)
-- ---------------------------------------------------------------------
create table if not exists public.txn_whatsapp_alert_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  min_amount numeric not null default 1000,
  cash_bank_from text not null default '1000',
  cash_bank_to text not null default '1099',
  extra_accounts text[] not null default array['1100','1150']::text[],
  -- source_module ke naam; '%' wala pattern LIKE se milta hai
  excluded_modules text[] not null default array[
    'pos','pos_return','pos_shift_close','pos_shift_close_repair',
    'opening_balance','customer_import','customer_opening_adjustment',
    'reconciliation','%correction%','%repair%'
  ]::text[],
  max_age_hours integer not null default 24,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.txn_whatsapp_alert_settings (id) values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) Qatar
-- ---------------------------------------------------------------------
create table if not exists public.txn_whatsapp_alerts (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id),
  entry_number text,
  entry_date date,
  source_module text,
  alert_type text not null,
  amount numeric not null,
  party_label text,
  account_label text,
  detail text,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  recipient text,
  wa_message_id text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint txn_whatsapp_alerts_entry_unique unique (entry_id)
);

create index if not exists idx_txn_whatsapp_alerts_status
  on public.txn_whatsapp_alerts(status, created_at);

alter table public.txn_whatsapp_alerts enable row level security;
alter table public.txn_whatsapp_alert_settings enable row level security;

drop policy if exists "Owner/Admin can view txn alerts" on public.txn_whatsapp_alerts;
create policy "Owner/Admin can view txn alerts"
  on public.txn_whatsapp_alerts for select
  using (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]));

drop policy if exists "Owner/Admin can view txn alert settings" on public.txn_whatsapp_alert_settings;
create policy "Owner/Admin can view txn alert settings"
  on public.txn_whatsapp_alert_settings for select
  using (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]));

drop policy if exists "Owner/Admin can update txn alert settings" on public.txn_whatsapp_alert_settings;
create policy "Owner/Admin can update txn alert settings"
  on public.txn_whatsapp_alert_settings for update
  using (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]))
  with check (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]));

revoke all on public.txn_whatsapp_alerts from anon;
revoke all on public.txn_whatsapp_alert_settings from anon;

-- ---------------------------------------------------------------------
-- 3) Party ka naam
-- ---------------------------------------------------------------------
create or replace function public.fn_txn_alert_party_name(p_type text, p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare v text;
begin
  if p_id is null then return null; end if;
  if p_type = 'customer' then
    select coalesce(nullif(business_name,''), name) into v from customers where id = p_id;
  elsif p_type = 'farmer' then
    select full_name || coalesce(' (' || farmer_code || ')', '') into v from farmers where id = p_id;
  elsif p_type = 'supplier' then
    select coalesce(nullif(company_name,''), name) into v from suppliers where id = p_id;
  elsif p_type = 'branch' then
    select name into v from branches where id = p_id;
  elsif p_type = 'staff' then
    select full_name into v from profiles where id = p_id;
  end if;
  return v;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) Trigger: entry ko qatar mein dalna (DEFERRED, ek entry = ek row)
-- ---------------------------------------------------------------------
create or replace function public.fn_queue_txn_whatsapp_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.txn_whatsapp_alert_settings%rowtype;
  e record;
  v_cash_dr numeric := 0;
  v_cash_cr numeric := 0;
  v_recv_dr numeric := 0;
  v_recv_cr numeric := 0;
  v_dr_accts text;
  v_cr_accts text;
  v_party text;
  v_type text;
  v_amount numeric;
  v_account text;
  pat text;
begin
  -- Alert kabhi bhi asal entry ko nahi rokay ga
  begin
    select * into s from public.txn_whatsapp_alert_settings where id;
    if not found or not s.enabled then return null; end if;

    -- Sirf daayre wali line par aage barhein (sasta filter)
    if not (
      (new.account_code between s.cash_bank_from and s.cash_bank_to
         and length(new.account_code) = length(s.cash_bank_from))
      or new.account_code = any (s.extra_accounts)
    ) then
      return null;
    end if;

    if exists (select 1 from public.txn_whatsapp_alerts where entry_id = new.entry_id) then
      return null;
    end if;

    select id, entry_number, entry_date, description, source_module
      into e from public.journal_entries where id = new.entry_id;
    if not found then return null; end if;

    foreach pat in array s.excluded_modules loop
      if coalesce(e.source_module, '') like pat then return null; end if;
    end loop;

    select
      coalesce(sum(debit)  filter (where is_cash), 0),
      coalesce(sum(credit) filter (where is_cash), 0),
      coalesce(sum(debit)  filter (where is_recv), 0),
      coalesce(sum(credit) filter (where is_recv), 0),
      string_agg(distinct acct_name, ' + ') filter (where is_cash and debit > 0),
      string_agg(distinct acct_name, ' + ') filter (where is_cash and credit > 0)
    into v_cash_dr, v_cash_cr, v_recv_dr, v_recv_cr, v_dr_accts, v_cr_accts
    from (
      select l.debit, l.credit,
             (l.account_code between s.cash_bank_from and s.cash_bank_to
               and length(l.account_code) = length(s.cash_bank_from)) as is_cash,
             (l.account_code = any (s.extra_accounts)) as is_recv,
             coalesce(g.name, l.account_code) || ' (' || l.account_code || ')' as acct_name
      from public.journal_lines l
      left join public.gl_accounts g on g.code = l.account_code
      where l.entry_id = new.entry_id
    ) x;

    if v_cash_dr > 0 and v_cash_cr > 0 then
      v_type := 'Bank/Cash Transfer';
      v_amount := greatest(v_cash_dr, v_cash_cr);
      v_account := coalesce(v_cr_accts, '-') || ' -> ' || coalesce(v_dr_accts, '-');
    elsif v_cash_dr > 0 then
      v_type := case when v_recv_cr > 0 or e.source_module ilike '%recovery%'
                     then 'Recovery' else 'Raqam Wusool' end;
      v_amount := v_cash_dr;
      v_account := v_dr_accts;
    elsif v_cash_cr > 0 then
      v_type := case when v_recv_dr > 0 then 'Udhaar Diya (naqad)' else 'Payment Gayi' end;
      v_amount := v_cash_cr;
      v_account := v_cr_accts;
    elsif v_recv_dr > 0 then
      v_type := 'Udhaar Diya';
      v_amount := v_recv_dr;
      v_account := 'Khata (udhaar)';
    else
      v_type := 'Khata Kami';
      v_amount := v_recv_cr;
      v_account := 'Khata';
    end if;

    if coalesce(v_amount, 0) <= s.min_amount then return null; end if;

    select public.fn_txn_alert_party_name(l.party_type, l.party_id)
      into v_party
    from public.journal_lines l
    where l.entry_id = new.entry_id and l.party_id is not null
    order by l.line_order nulls last
    limit 1;

    insert into public.txn_whatsapp_alerts
      (entry_id, entry_number, entry_date, source_module, alert_type, amount,
       party_label, account_label, detail)
    values
      (new.entry_id, e.entry_number, e.entry_date, e.source_module, v_type, round(v_amount, 2),
       coalesce(v_party, '-'), coalesce(v_account, '-'),
       left(coalesce(nullif(e.description, ''), e.source_module, '-'), 200))
    on conflict (entry_id) do nothing;
  exception when others then
    raise warning 'txn whatsapp alert queue skipped for entry %: %', new.entry_id, sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists trg_queue_txn_whatsapp_alert on public.journal_lines;
create constraint trigger trg_queue_txn_whatsapp_alert
  after insert on public.journal_lines
  deferrable initially deferred
  for each row execute function public.fn_queue_txn_whatsapp_alert();

-- ---------------------------------------------------------------------
-- 5) Claim (do cron ek sath chalein to bhi ek row ek dafa)
-- ---------------------------------------------------------------------
create or replace function public.fn_claim_txn_whatsapp_alerts(p_limit integer default 20)
returns setof public.txn_whatsapp_alerts
language plpgsql
security definer
set search_path = public
as $$
declare v_max_age integer;
begin
  select max_age_hours into v_max_age from public.txn_whatsapp_alert_settings where id;
  v_max_age := coalesce(v_max_age, 24);

  -- 10 minute se "processing" mein atki row wapas pending
  update public.txn_whatsapp_alerts
     set status = 'pending'
   where status = 'processing' and claimed_at < now() - interval '10 minutes';

  -- Bohat purani pending: bhejne ke bajaye skipped
  update public.txn_whatsapp_alerts
     set status = 'skipped',
         last_error = 'Purana alert (' || v_max_age || ' ghante se zyada) -- bheja nahi gaya.'
   where status = 'pending' and created_at < now() - make_interval(hours => v_max_age);

  return query
  update public.txn_whatsapp_alerts a
     set status = 'processing', claimed_at = now(), attempts = a.attempts + 1
   where a.id in (
     select id from public.txn_whatsapp_alerts
      where status = 'pending'
      order by created_at
      limit greatest(1, least(coalesce(p_limit, 20), 100))
      for update skip locked
   )
  returning a.*;
end;
$$;

revoke all on function public.fn_claim_txn_whatsapp_alerts(integer) from public, anon, authenticated;
grant execute on function public.fn_claim_txn_whatsapp_alerts(integer) to service_role;
revoke all on function public.fn_queue_txn_whatsapp_alert() from public, anon, authenticated;
revoke all on function public.fn_txn_alert_party_name(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) Admin safha: /admin/txn-alerts
-- ---------------------------------------------------------------------
insert into features (key, label, label_en, label_ur, route, icon, is_sensitive, description, is_active)
values (
  'system.txn_alerts', 'WhatsApp Len-den Alerts', 'WhatsApp Transaction Alerts', 'WhatsApp Len-den Alerts',
  '/admin/txn-alerts', 'MessageSquare', true,
  'Rs 1,000 se upar har len-den ka malik ko WhatsApp alert -- qatar, bheje gaye aur nakaam.',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, description = excluded.description, is_active = true;

insert into role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('admin', 'system.txn_alerts', array['view','edit']::text[], 'all'),
  ('owner', 'system.txn_alerts', array['view','edit']::text[], 'all'),
  ('super_admin', 'system.txn_alerts', array['view','edit']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
