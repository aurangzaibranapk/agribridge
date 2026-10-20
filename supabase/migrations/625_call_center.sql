-- 625: Call Center Agent — complaints, audit, SMS queue, view-only lock.
--
-- Additive. Purani tables ka data nahi mitata. Live par tab tak nahi
-- jab tak backup verify na ho (624 pehle commit ho chuki ho).
--
-- Agent fn_is_any_staff mein NAHI. Wo blanket staff-write nahi paata.
-- Khata sirf SECURITY DEFINER se, masked phone ke sath. Likhai par
-- trigger: agent journal, doodh, rate, customer balance nahi chhoo sakta.
-- Shikayat ka number sirf SMS queue mein. WhatsApp ka koi raasta nahi.

-- 051 ka purana check sirf 5 roles jaanta tha. Enum asal taala hai.
alter table public.profiles drop constraint if exists profiles_role_check;

-- ---------------------------------------------------------------------------
-- Counters, complaints, SMS, audit, agents
-- ---------------------------------------------------------------------------
create table if not exists public.cc_counters (
  kind text primary key,
  last_number integer not null default 0
);

create table if not exists public.cc_agents (
  profile_id uuid primary key references public.profiles(id),
  organization_id uuid references public.organizations(id),
  agent_code text not null unique,
  mobile text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.cc_complaints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  complaint_number text not null unique,
  party_kind text not null check (party_kind in ('farmer', 'customer', 'dealer')),
  party_id uuid not null,
  caller_name text not null,
  caller_code text,
  caller_phone text,
  category text not null check (category in ('doodh', 'khaad', 'payment', 'khata_ghalat', 'delivery', 'other')),
  department text not null check (department in ('dairy', 'accounts', 'logistics', 'sales', 'general')),
  priority text not null check (priority in ('high', 'normal', 'low')),
  sla_hours integer not null check (sla_hours > 0),
  sla_due_at timestamptz not null,
  description text not null check (length(trim(description)) >= 8),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  channel text not null default 'sms' check (channel = 'sms'),
  created_by uuid not null references public.profiles(id),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chk_cc_maker check (status <> 'resolved' or resolved_by is distinct from created_by)
);

create index if not exists cc_complaints_status_idx on public.cc_complaints (status, created_at desc);
create index if not exists cc_complaints_party_idx on public.cc_complaints (party_kind, party_id);
create index if not exists cc_complaints_creator_idx on public.cc_complaints (created_by);

create table if not exists public.cc_sms_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  complaint_id uuid references public.cc_complaints(id),
  to_phone text not null,
  body text not null,
  channel text not null default 'sms' check (channel = 'sms'),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'no_phone')),
  provider text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists cc_sms_outbox_status_idx on public.cc_sms_outbox (status, created_at);

create table if not exists public.cc_lookup_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  agent_id uuid not null references public.profiles(id),
  party_kind text,
  party_id uuid,
  party_code text,
  party_name text,
  phone_masked text,
  action text not null check (action in ('khata_view', 'profile_view')),
  device text,
  created_at timestamptz not null default now()
);

create index if not exists cc_lookup_audit_agent_idx on public.cc_lookup_audit (agent_id, created_at desc);
create index if not exists cc_lookup_audit_party_idx on public.cc_lookup_audit (party_id, created_at desc);

alter table public.cc_counters enable row level security;
alter table public.cc_agents enable row level security;
alter table public.cc_complaints enable row level security;
alter table public.cc_sms_outbox enable row level security;
alter table public.cc_lookup_audit enable row level security;

revoke all on public.cc_counters from public, anon, authenticated;
revoke all on public.cc_agents from public, anon, authenticated;
revoke all on public.cc_complaints from public, anon, authenticated;
revoke all on public.cc_sms_outbox from public, anon, authenticated;
revoke all on public.cc_lookup_audit from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.fn_cc_mask_phone(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(p_raw, ''), '\D', '', 'g');
  stars int;
begin
  if length(d) < 6 then
    return '****';
  end if;
  stars := greatest(4, length(d) - 6);
  return substr(d, 1, 4) || '-' || repeat('*', stars) || substr(d, length(d) - 1, 2);
end;
$$;

create or replace function public.fn_cc_customer_code(p_id uuid)
returns text
language plpgsql
immutable
as $$
declare n bigint;
begin
  n := ('x' || substr(md5(p_id::text), 1, 8))::bit(32)::bigint;
  if n < 0 then n := -n; end if;
  return 'CUS-' || lpad((n % 1000000)::text, 6, '0');
end;
$$;

create or replace function public.fn_cc_actor_roles()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select array[p.role::text] || coalesce(p.extra_roles::text[], '{}'::text[])
       from public.profiles p
      where p.id = auth.uid() and p.is_active),
    '{}'::text[]
  );
$$;

create or replace function public.fn_cc_is_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select 'call_center_agent' = any (public.fn_cc_actor_roles());
$$;

create or replace function public.fn_cc_can_close(p_department text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin')
        or (p_department = 'dairy' and r.role = 'milk_collection')
        or (p_department = 'accounts' and r.role = 'finance')
        or (p_department = 'logistics' and r.role = 'warehouse')
        or (p_department = 'sales' and r.role = 'sales_staff')
        or (p_department = 'general' and r.role in ('admin', 'admin_assistant'))
  );
$$;

create or replace function public.fn_cc_category_route(p_category text)
returns table (department text, priority text, sla_hours int)
language sql
immutable
as $$
  select case p_category
           when 'doodh' then 'dairy'
           when 'khaad' then 'sales'
           when 'payment' then 'accounts'
           when 'khata_ghalat' then 'accounts'
           when 'delivery' then 'logistics'
           else 'general'
         end,
         case when p_category in ('doodh', 'payment', 'khata_ghalat') then 'high' else 'normal' end,
         case p_category
           when 'doodh' then 24
           when 'payment' then 24
           when 'khata_ghalat' then 24
           when 'khaad' then 48
           when 'delivery' then 48
           else 72
         end;
$$;

create or replace function public.fn_cc_next_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.cc_counters (kind, last_number) values (p_kind, 0)
  on conflict (kind) do nothing;
  update public.cc_counters set last_number = last_number + 1
   where kind = p_kind
  returning last_number into n;
  if p_kind = 'agent' then
    return 'AGT-' || lpad(n::text, 4, '0');
  end if;
  return 'CMP-' || lpad(n::text, 6, '0');
end;
$$;

-- Agent seedha likhe to bhi khata / rate / doodh nahi badalta.
create or replace function public.fn_cc_agent_cannot_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.fn_cc_is_agent() then
    raise exception 'Call Center Agent sirf dekh sakta hai. Khata, rate, payment ya doodh ki likhai band hai.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'journal_entries', 'journal_lines', 'farmer_credit_ledger',
    'milk_entries', 'milk_payments', 'products', 'customers'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_cc_agent_no_write on public.%I', t);
      execute format(
        'create trigger trg_cc_agent_no_write before insert or update or delete on public.%I for each row execute function public.fn_cc_agent_cannot_write()',
        t
      );
    end if;
  end loop;
end $$;

create or replace function public.fn_cc_complaint_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_dept text; v_pri text; v_hours int;
begin
  if new.channel is distinct from 'sms' then
    raise exception 'Shikayat ka paighaam sirf SMS se jaata hai. WhatsApp band hai.';
  end if;
  new.channel := 'sms';
  if new.complaint_number is null or btrim(new.complaint_number) = '' then
    new.complaint_number := public.fn_cc_next_number('complaint');
  end if;
  select department, priority, sla_hours into v_dept, v_pri, v_hours
    from public.fn_cc_category_route(new.category);
  new.department := v_dept;
  new.priority := v_pri;
  new.sla_hours := v_hours;
  new.sla_due_at := coalesce(new.sla_due_at, now() + make_interval(hours => v_hours));
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.fn_cc_complaint_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Shikayat mitai nahi ja sakti.';
  end if;
  if public.fn_cc_is_agent() then
    raise exception 'Call Center Agent shikayat ka status nahi badal sakta. Sirf naya darj hota hai.';
  end if;
  if new.complaint_number is distinct from old.complaint_number
     or new.created_by is distinct from old.created_by
     or new.category is distinct from old.category
     or new.department is distinct from old.department
     or new.caller_phone is distinct from old.caller_phone
     or new.caller_name is distinct from old.caller_name
     or new.party_id is distinct from old.party_id
     or new.party_kind is distinct from old.party_kind
     or new.description is distinct from old.description
     or new.channel is distinct from old.channel
     or new.priority is distinct from old.priority
     or new.sla_hours is distinct from old.sla_hours
  then
    raise exception 'Sirf status badla ja sakta hai.';
  end if;
  if new.status is distinct from old.status and new.status in ('in_progress', 'resolved') then
    if not public.fn_cc_can_close(new.department) then
      raise exception 'Sirf assigned department is shikayat ko aage barha sakta hai.';
    end if;
  end if;
  if new.status = 'resolved' then
    if new.resolved_by is null then
      new.resolved_by := auth.uid();
    end if;
    if new.resolved_at is null then
      new.resolved_at := now();
    end if;
    if new.resolved_by is not distinct from new.created_by then
      raise exception 'Jis ne shikayat banayi, wo khud band nahi kar sakta.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cc_complaint_ins on public.cc_complaints;
create trigger trg_cc_complaint_ins
  before insert on public.cc_complaints
  for each row execute function public.fn_cc_complaint_before_insert();

drop trigger if exists trg_cc_complaint_guard on public.cc_complaints;
create trigger trg_cc_complaint_guard
  before update or delete on public.cc_complaints
  for each row execute function public.fn_cc_complaint_guard();

-- ---------------------------------------------------------------------------
-- Caller dhoondna (poora number wapas nahi)
-- ---------------------------------------------------------------------------
create or replace function public.fn_cc_require_reader()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Login zaroori hai.';
  end if;
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in (
       'call_center_agent', 'owner', 'super_admin', 'admin', 'admin_assistant',
       'finance', 'milk_collection', 'warehouse', 'sales_staff', 'manager'
     )
  ) then
    raise exception 'Call center aap ke ohde par khula nahi.';
  end if;
end;
$$;

create or replace function public.fn_cc_search(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_digits text;
  v_rows jsonb;
begin
  perform public.fn_cc_require_reader();
  if length(v_q) < 2 then
    return '[]'::jsonb;
  end if;
  v_digits := regexp_replace(v_q, '\D', '', 'g');
  with hits as (
    select 'farmer'::text as kind, f.id, coalesce(f.full_name, '(naam nahi)') as name,
           f.farmer_code as code, f.phone_number as phone, f.village as place
      from public.farmers f
     where f.is_deleted = false
       and (
         f.full_name ilike '%' || v_q || '%'
         or f.farmer_code ilike '%' || v_q || '%'
         or (length(v_digits) >= 4 and regexp_replace(coalesce(f.phone_number, ''), '\D', '', 'g') like '%' || v_digits || '%')
       )
    union all
    select 'customer', c.id, c.name, public.fn_cc_customer_code(c.id), c.phone_number, c.address
      from public.customers c
     where c.is_deleted = false
       and (
         c.name ilike '%' || v_q || '%'
         or public.fn_cc_customer_code(c.id) ilike '%' || v_q || '%'
         or (length(v_digits) >= 4 and regexp_replace(coalesce(c.phone_number, ''), '\D', '', 'g') like '%' || v_digits || '%')
       )
    union all
    select 'dealer', d.id, d.business_name, d.dealer_code, d.phone_number, d.district
      from public.dealers d
     where d.is_active = true
       and (
         d.business_name ilike '%' || v_q || '%'
         or d.dealer_code ilike '%' || v_q || '%'
         or (length(v_digits) >= 4 and regexp_replace(coalesce(d.phone_number, ''), '\D', '', 'g') like '%' || v_digits || '%')
       )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', kind, 'id', id, 'name', name, 'code', code,
    'place', place, 'phone_masked', public.fn_cc_mask_phone(phone)
  )), '[]'::jsonb)
    into v_rows
    from (select * from hits limit 12) s;
  return v_rows;
end;
$$;

create or replace function public.fn_cc_party_360(p_kind text, p_id uuid, p_device text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_phone text;
  v_code text;
  v_place text;
  v_type text;
  v_org uuid;
  v_count int := 0;
  v_signed numeric;
  v_lines jsonb := '[]'::jsonb;
  v_balance numeric;
  v_side text;
  v_tracked boolean := false;
  v_milk jsonb;
  v_rates jsonb := '[]'::jsonb;
  v_complaints jsonb := '[]'::jsonb;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_liters numeric;
  v_rate numeric;
begin
  perform public.fn_cc_require_reader();
  if p_kind not in ('farmer', 'customer', 'dealer') then
    raise exception 'Party ki qism sahi nahi.';
  end if;

  if p_kind = 'farmer' then
    select f.full_name, f.phone_number, f.farmer_code, f.village, f.organization_id
      into v_name, v_phone, v_code, v_place, v_org
      from public.farmers f
     where f.id = p_id and f.is_deleted = false;
    v_type := 'Kisan';
  elsif p_kind = 'customer' then
    select c.name, c.phone_number, public.fn_cc_customer_code(c.id), c.address, c.organization_id
      into v_name, v_phone, v_code, v_place, v_org
      from public.customers c
     where c.id = p_id and c.is_deleted = false;
    v_type := 'Customer';
  else
    select d.business_name, d.phone_number, d.dealer_code, d.district, d.organization_id
      into v_name, v_phone, v_code, v_place, v_org
      from public.dealers d
     where d.id = p_id and d.is_active = true;
    v_type := 'Dealer';
  end if;

  if v_name is null then
    return jsonb_build_object('found', false);
  end if;

  insert into public.cc_lookup_audit (
    organization_id, agent_id, party_kind, party_id, party_code, party_name, phone_masked, action, device
  ) values (
    v_org, auth.uid(), p_kind, p_id, v_code, v_name, public.fn_cc_mask_phone(v_phone), 'khata_view', left(coalesce(p_device, ''), 300)
  );

  with raw as (
    select me.entry_date, ('Doodh ' || trim(to_char(me.quantity_liters, 'FM999990.0')) || ' L') as detail,
           null::numeric as debit, me.total_amount as credit, 1 as ord
      from public.milk_entries me
     where p_kind = 'farmer' and me.farmer_id = p_id and me.total_amount is not null
    union all
    select mp.payment_date, 'Payment ada (kisan ko)', mp.amount, null::numeric, 2
      from public.milk_payments mp
     where p_kind = 'farmer' and mp.farmer_id = p_id
    union all
    select fcl.created_at::date,
           coalesce(nullif(fcl.notes, ''), fcl.source_type::text),
           case when fcl.ledger_type::text = 'debit' then fcl.amount else null end,
           case when fcl.ledger_type::text = 'credit' then fcl.amount else null end,
           3
      from public.farmer_credit_ledger fcl
     where p_kind = 'farmer' and fcl.farmer_id = p_id
    union all
    select e.entry_date, coalesce(l.memo, e.description, e.source_module),
           nullif(coalesce(l.debit, 0), 0), nullif(coalesce(l.credit, 0), 0), 4
      from public.journal_lines l
      join public.journal_entries e on e.id = l.entry_id
     where p_kind = 'farmer' and l.party_type = 'farmer' and l.party_id = p_id
       and e.source_module not in ('farmer_credit', 'milk_collection', 'milk_payment', 'milk')
    union all
    select e.entry_date, coalesce(l.memo, e.description, 'Khata'),
           nullif(coalesce(l.debit, 0), 0), nullif(coalesce(l.credit, 0), 0), 5
      from public.journal_lines l
      join public.journal_entries e on e.id = l.entry_id
     where p_kind = 'customer' and l.party_type = 'customer' and l.party_id = p_id
       and l.account_code = '1100'
    union all
    select e.entry_date, coalesce(l.memo, e.description, 'Khata'),
           nullif(coalesce(l.debit, 0), 0), nullif(coalesce(l.credit, 0), 0), 6
      from public.journal_lines l
      join public.journal_entries e on e.id = l.entry_id
     where p_kind = 'dealer' and l.party_type = 'dealer' and l.party_id = p_id
  ),
  ordered as (
    select entry_date, detail, debit, credit, ord,
           sum(
             case when p_kind = 'farmer'
               then coalesce(credit, 0) - coalesce(debit, 0)
               else coalesce(debit, 0) - coalesce(credit, 0)
             end
           ) over (order by entry_date, ord, detail) as running
      from raw
  )
  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object(
           'date', to_char(entry_date, 'YYYY-MM-DD'),
           'detail', detail,
           'debit', debit,
           'credit', credit,
           'balance', abs(running),
           'side', case when running >= 0 then (case when p_kind = 'farmer' then 'Cr' else 'Dr' end)
                        else (case when p_kind = 'farmer' then 'Dr' else 'Cr' end) end
         ) order by entry_date desc, ord desc), '[]'::jsonb)
    into v_count, v_lines
    from (
      select * from ordered order by entry_date desc, ord desc limit 5
    ) last5;

  if v_count > 0 then
    select sum(
             case when p_kind = 'farmer'
               then coalesce(credit, 0) - coalesce(debit, 0)
               else coalesce(debit, 0) - coalesce(credit, 0)
             end
           )
      into v_signed
      from (
        select me.total_amount as credit, null::numeric as debit
          from public.milk_entries me
         where p_kind = 'farmer' and me.farmer_id = p_id and me.total_amount is not null
        union all
        select null::numeric, mp.amount from public.milk_payments mp
         where p_kind = 'farmer' and mp.farmer_id = p_id
        union all
        select case when fcl.ledger_type::text = 'credit' then fcl.amount end,
               case when fcl.ledger_type::text = 'debit' then fcl.amount end
          from public.farmer_credit_ledger fcl
         where p_kind = 'farmer' and fcl.farmer_id = p_id
        union all
        select nullif(coalesce(l.credit, 0), 0), nullif(coalesce(l.debit, 0), 0)
          from public.journal_lines l
          join public.journal_entries e on e.id = l.entry_id
         where p_kind = 'farmer' and l.party_type = 'farmer' and l.party_id = p_id
           and e.source_module not in ('farmer_credit', 'milk_collection', 'milk_payment', 'milk')
        union all
        select nullif(coalesce(l.credit, 0), 0), nullif(coalesce(l.debit, 0), 0)
          from public.journal_lines l
         where p_kind = 'customer' and l.party_type = 'customer' and l.party_id = p_id and l.account_code = '1100'
        union all
        select nullif(coalesce(l.credit, 0), 0), nullif(coalesce(l.debit, 0), 0)
          from public.journal_lines l
         where p_kind = 'dealer' and l.party_type = 'dealer' and l.party_id = p_id
      ) all_lines;
    v_tracked := true;
    v_balance := abs(coalesce(v_signed, 0));
    if p_kind = 'farmer' then
      v_side := case when coalesce(v_signed, 0) >= 0 then 'Cr' else 'Dr' end;
    else
      v_side := case when coalesce(v_signed, 0) >= 0 then 'Dr' else 'Cr' end;
    end if;
  end if;

  if p_kind = 'farmer' then
    select coalesce(sum(me.quantity_liters), 0)
      into v_liters
      from public.milk_entries me
     where me.farmer_id = p_id and me.entry_date = v_today;
    select me.rate_per_liter
      into v_rate
      from public.milk_entries me
     where me.farmer_id = p_id and me.rate_per_liter is not null
     order by me.entry_date desc, me.created_at desc
     limit 1;
    v_milk := jsonb_build_object('tracked', true, 'today_liters', v_liters, 'rate', v_rate, 'next_payment', null);
  else
    v_milk := jsonb_build_object('tracked', false, 'today_liters', null, 'rate', null, 'next_payment', null);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', name, 'rate', rate
         ) order by name), '[]'::jsonb)
    into v_rates
    from (
      select p.name, p.selling_price as rate
        from public.products p
        left join public.categories c on c.id = p.category_id
       where p.is_deleted = false
         and p.selling_price > 0
         and (
           c.name ilike any (array['%fertilizer%', '%fertiliser%', '%khaad%', '%seed%', '%beej%', '%urea%', '%dap%'])
           or p.name ilike any (array['%urea%', '%dap%', '%beej%', '%seed%', '%gandum%', '%makai%', '%khaad%', '%bij%'])
         )
       order by p.name
       limit 8
    ) r;

  select coalesce(jsonb_agg(jsonb_build_object(
           'number', complaint_number, 'category', category, 'status', status
         ) order by created_at desc), '[]'::jsonb)
    into v_complaints
    from (
      select complaint_number, category, status, created_at
        from public.cc_complaints
       where party_kind = p_kind and party_id = p_id
       order by created_at desc
       limit 8
    ) c;

  return jsonb_build_object(
    'found', true,
    'kind', p_kind,
    'id', p_id,
    'name', v_name,
    'code', v_code,
    'place', v_place,
    'type_label', v_type,
    'phone_masked', public.fn_cc_mask_phone(v_phone),
    'tracked', v_tracked,
    'balance', v_balance,
    'balance_side', v_side,
    'lines', coalesce(v_lines, '[]'::jsonb),
    'milk', v_milk,
    'rates', coalesce(v_rates, '[]'::jsonb),
    'complaints', coalesce(v_complaints, '[]'::jsonb)
  );
end;
$$;

create or replace function public.fn_cc_console()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi');
  v_recent jsonb;
  v_calls int;
  v_made int;
  v_open int;
begin
  perform public.fn_cc_require_reader();
  select count(*)::int into v_calls
    from public.cc_lookup_audit
   where agent_id = auth.uid() and action = 'khata_view' and created_at >= v_start;
  select count(*)::int into v_made
    from public.cc_complaints
   where created_by = auth.uid() and created_at >= v_start;
  select count(*)::int into v_open
    from public.cc_complaints
   where status = 'open';
  select coalesce(jsonb_agg(jsonb_build_object(
    'at', to_char(created_at at time zone 'Asia/Karachi', 'HH24:MI'),
    'name', party_name,
    'kind', party_kind,
    'id', party_id,
    'code', party_code,
    'phone_masked', phone_masked
  ) order by created_at desc), '[]'::jsonb)
    into v_recent
    from (
      select created_at, party_name, party_kind, party_id, party_code, phone_masked
        from public.cc_lookup_audit
       where agent_id = auth.uid() and action = 'khata_view'
       order by created_at desc
       limit 8
    ) s;
  return jsonb_build_object(
    'calls_today', v_calls,
    'complaints_today', v_made,
    'open_complaints', v_open,
    'recent', v_recent
  );
end;
$$;

create or replace function public.fn_cc_create_complaint(
  p_kind text,
  p_id uuid,
  p_category text,
  p_description text,
  p_channel text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_phone text;
  v_code text;
  v_org uuid;
  v_id uuid;
  v_number text;
  v_dept text;
  v_pri text;
  v_hours int;
  v_digits text;
  v_body text;
  v_sms text;
begin
  perform public.fn_cc_require_reader();
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('call_center_agent', 'owner', 'super_admin', 'admin')
  ) then
    raise exception 'Shikayat sirf Call Center Agent ya Admin darj karta hai.';
  end if;
  if p_channel is distinct from 'sms' then
    raise exception 'Shikayat ka paighaam sirf SMS se jaata hai. WhatsApp band hai.';
  end if;
  if p_category not in ('doodh', 'khaad', 'payment', 'khata_ghalat', 'delivery', 'other') then
    raise exception 'Category sahi nahi.';
  end if;
  if length(btrim(coalesce(p_description, ''))) < 8 then
    raise exception 'Tafseel kam az kam 8 harf ki ho.';
  end if;

  if p_kind = 'farmer' then
    select full_name, phone_number, farmer_code, organization_id
      into v_name, v_phone, v_code, v_org
      from public.farmers where id = p_id and is_deleted = false;
  elsif p_kind = 'customer' then
    select name, phone_number, public.fn_cc_customer_code(id), organization_id
      into v_name, v_phone, v_code, v_org
      from public.customers where id = p_id and is_deleted = false;
  elsif p_kind = 'dealer' then
    select business_name, phone_number, dealer_code, organization_id
      into v_name, v_phone, v_code, v_org
      from public.dealers where id = p_id and is_active = true;
  else
    raise exception 'Party ki qism sahi nahi.';
  end if;
  if v_name is null then
    raise exception 'Caller nahi mila.';
  end if;

  insert into public.cc_complaints (
    organization_id, party_kind, party_id, caller_name, caller_code, caller_phone,
    category, department, priority, sla_hours, sla_due_at, description, channel, created_by, complaint_number
  ) values (
    v_org, p_kind, p_id, v_name, v_code, v_phone,
    p_category, 'general', 'normal', 24, now(), btrim(p_description), 'sms', auth.uid(), null
  )
  returning id, complaint_number, department, priority, sla_hours
    into v_id, v_number, v_dept, v_pri, v_hours;

  v_body := 'Al Rana Traders: Aap ki shikayat ' || v_number
    || ' darj ho gayi hai (' || p_category || '). Department: ' || v_dept
    || '. Hum ' || v_hours || ' ghante mein rabta karenge.';
  v_digits := regexp_replace(coalesce(v_phone, ''), '\D', '', 'g');
  if length(v_digits) >= 10 then
    insert into public.cc_sms_outbox (organization_id, complaint_id, to_phone, body, channel, status)
    values (v_org, v_id, v_phone, v_body, 'sms', 'queued');
    v_sms := 'queued';
  else
    insert into public.cc_sms_outbox (organization_id, complaint_id, to_phone, body, channel, status, last_error)
    values (v_org, v_id, coalesce(v_phone, ''), v_body, 'sms', 'no_phone', 'Caller ka mobile darj nahi.');
    v_sms := 'no_phone';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'number', v_number,
    'department', v_dept,
    'priority', v_pri,
    'sla_hours', v_hours,
    'sms', v_sms,
    'phone_masked', public.fn_cc_mask_phone(v_phone)
  );
end;
$$;

create or replace function public.fn_cc_set_complaint_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_number text; v_status text;
begin
  perform public.fn_cc_require_reader();
  if p_status not in ('open', 'in_progress', 'resolved') then
    raise exception 'Status sahi nahi.';
  end if;
  update public.cc_complaints
     set status = p_status
   where id = p_id
  returning complaint_number, status into v_number, v_status;
  if v_number is null then
    raise exception 'Shikayat nahi mili.';
  end if;
  return jsonb_build_object('ok', true, 'number', v_number, 'status', v_status);
end;
$$;

create or replace function public.fn_cc_complaints_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rows jsonb;
begin
  perform public.fn_cc_require_reader();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'number', complaint_number,
    'caller_name', caller_name,
    'caller_code', caller_code,
    'category', category,
    'department', department,
    'priority', priority,
    'status', status,
    'created_at', created_at,
    'sla_due_at', sla_due_at,
    'created_by', created_by,
    'created_by_name', created_by_name
  ) order by created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select c.id, c.complaint_number, c.caller_name, c.caller_code, c.category, c.department,
             c.priority, c.status, c.created_at, c.sla_due_at, c.created_by, p.full_name as created_by_name
        from public.cc_complaints c
        left join public.profiles p on p.id = c.created_by
       order by c.created_at desc
       limit 200
    ) s;
  return jsonb_build_object(
    'open', (select count(*) from public.cc_complaints where status = 'open'),
    'in_progress', (select count(*) from public.cc_complaints where status = 'in_progress'),
    'resolved', (select count(*) from public.cc_complaints where status = 'resolved'),
    'sla_breach', (select count(*) from public.cc_complaints where status <> 'resolved' and sla_due_at < now()),
    'rows', v_rows
  );
end;
$$;

create or replace function public.fn_cc_register_agent(p_profile uuid, p_mobile text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_org uuid;
begin
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin', 'admin')
  ) then
    raise exception 'Agent sirf Admin banata hai. Koi invite nahi.';
  end if;
  if p_profile is null then
    raise exception 'Account nahi mila.';
  end if;
  if exists (select 1 from public.cc_agents where profile_id = p_profile) then
    raise exception 'Ye agent pehle se maujood hai.';
  end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  update public.profiles
     set role = 'call_center_agent'::public.user_role,
         full_name = coalesce(nullif(btrim(p_name), ''), full_name),
         phone_number = nullif(btrim(p_mobile), ''),
         is_active = true,
         organization_id = coalesce(organization_id, v_org)
   where id = p_profile;
  if not found then
    raise exception 'Profile nahi mili. Auth trigger ka intezar hai.';
  end if;
  v_code := public.fn_cc_next_number('agent');
  insert into public.cc_agents (profile_id, organization_id, agent_code, mobile, status, created_by)
  values (p_profile, v_org, v_code, nullif(btrim(p_mobile), ''), 'active', auth.uid());
  return jsonb_build_object('ok', true, 'agent_code', v_code);
end;
$$;

create or replace function public.fn_cc_list_agents()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi');
begin
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin', 'admin')
  ) then
    raise exception 'Agent ki fehrist sirf Admin dekhta hai.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.profile_id,
      'code', a.agent_code,
      'name', p.full_name,
      'status', a.status,
      'mobile_masked', public.fn_cc_mask_phone(a.mobile),
      'calls_today', (
        select count(*) from public.cc_lookup_audit l
         where l.agent_id = a.profile_id and l.action = 'khata_view' and l.created_at >= v_start
      )
    ) order by a.agent_code)
    from public.cc_agents a
    join public.profiles p on p.id = a.profile_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.fn_cc_audit_log(p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin', 'admin')
  ) then
    raise exception 'Audit sirf Admin dekhta hai.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'at', to_char(l.created_at at time zone 'Asia/Karachi', 'DD Mon HH24:MI'),
      'agent', p.full_name,
      'party', l.party_code || ' ' || coalesce(l.party_name, ''),
      'action', case l.action when 'khata_view' then 'Khata dekha' else l.action end,
      'device', coalesce(l.device, '')
    ) order by l.created_at desc)
    from (
      select * from public.cc_lookup_audit
       order by created_at desc
       limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) l
    left join public.profiles p on p.id = l.agent_id
  ), '[]'::jsonb);
end;
$$;

-- Queued SMS baad mein bhejne ke liye. Bhejna app karti hai, yahan sirf queue.
create or replace function public.fn_cc_claim_sms(p_limit int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from unnest(public.fn_cc_actor_roles()) r(role)
     where r.role in ('owner', 'super_admin', 'admin')
  ) then
    raise exception 'SMS queue sirf Admin dekhta hai.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'body', body, 'status', status, 'channel', channel, 'created_at', created_at
    ) order by created_at)
    from (
      select id, body, status, channel, created_at
        from public.cc_sms_outbox
       where status = 'queued'
       order by created_at
       limit least(greatest(coalesce(p_limit, 20), 1), 100)
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.fn_cc_mask_phone(text) from public, anon;
revoke all on function public.fn_cc_customer_code(uuid) from public, anon;
revoke all on function public.fn_cc_actor_roles() from public, anon;
revoke all on function public.fn_cc_is_agent() from public, anon;
revoke all on function public.fn_cc_can_close(text) from public, anon;
revoke all on function public.fn_cc_category_route(text) from public, anon;
revoke all on function public.fn_cc_next_number(text) from public, anon;
revoke all on function public.fn_cc_agent_cannot_write() from public, anon;
revoke all on function public.fn_cc_complaint_before_insert() from public, anon;
revoke all on function public.fn_cc_complaint_guard() from public, anon;
revoke all on function public.fn_cc_require_reader() from public, anon;
revoke all on function public.fn_cc_search(text) from public, anon;
revoke all on function public.fn_cc_party_360(text, uuid, text) from public, anon;
revoke all on function public.fn_cc_console() from public, anon;
revoke all on function public.fn_cc_create_complaint(text, uuid, text, text, text) from public, anon;
revoke all on function public.fn_cc_set_complaint_status(uuid, text) from public, anon;
revoke all on function public.fn_cc_complaints_board() from public, anon;
revoke all on function public.fn_cc_register_agent(uuid, text, text) from public, anon;
revoke all on function public.fn_cc_list_agents() from public, anon;
revoke all on function public.fn_cc_audit_log(int) from public, anon;
revoke all on function public.fn_cc_claim_sms(int) from public, anon;

grant execute on function public.fn_cc_search(text) to authenticated;
grant execute on function public.fn_cc_party_360(text, uuid, text) to authenticated;
grant execute on function public.fn_cc_console() to authenticated;
grant execute on function public.fn_cc_create_complaint(text, uuid, text, text, text) to authenticated;
grant execute on function public.fn_cc_set_complaint_status(uuid, text) to authenticated;
grant execute on function public.fn_cc_complaints_board() to authenticated;
grant execute on function public.fn_cc_register_agent(uuid, text, text) to authenticated;
grant execute on function public.fn_cc_list_agents() to authenticated;
grant execute on function public.fn_cc_audit_log(int) to authenticated;
grant execute on function public.fn_cc_claim_sms(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Features, madad, ijazat. Agent ko edit/payment nahi.
-- ---------------------------------------------------------------------------
insert into public.dashboards (key, label, sort_order, is_active)
values ('admin', 'Admin', 1, true)
on conflict (key) do nothing;

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values
  ('call-center', 'Call Center', 'Call Center', 'کال سینٹر',
   'Caller dhoondein, khata dekhein, shikayat darj karein. Likhai nahi.',
   'Look up a caller, see khata, file a complaint. No ledger writes.',
   'کالر تلاش کریں، کھاتہ دیکھیں، شکایت درج کریں۔ لکھائی نہیں۔',
   '/admin/call-center', 'Phone', true, true),
  ('call-center-board', 'Complaints Board', 'Complaints Board', 'شکایات بورڈ',
   'Khuli shikayat, SLA, aur department ka band karna.',
   'Open complaints, SLA, and department close.',
   'کھلی شکایت، ایس ایل اے، اور ڈیپارٹمنٹ کا بند کرنا۔',
   '/admin/call-center/complaints', 'ClipboardList', true, true),
  ('call-center-agents', 'Call Center Agents', 'Call Center Agents', 'کال سینٹر ایجنٹ',
   'Admin seedha agent banata hai. Koi invite nahi.',
   'Admin creates agents directly. No invites.',
   'ایڈمن براہ راست ایجنٹ بناتا ہے۔ کوئی دعوت نہیں۔',
   '/admin/call-center/agents', 'ShieldCheck', true, true)
on conflict (key) do update set
  route = excluded.route,
  label = excluded.label,
  description = excluded.description,
  is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values
  ('admin', 'call-center', 'Call Center', 8, 810),
  ('admin', 'call-center-board', 'Call Center', 8, 811),
  ('admin', 'call-center-agents', 'Call Center', 8, 812)
on conflict (dashboard_key, feature_key) do nothing;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope) values
  ('call_center_agent', 'call-center', array['view', 'create'], 'all'),
  ('call_center_agent', 'call-center-board', array['view'], 'all'),
  ('owner', 'call-center', array['view', 'create'], 'all'),
  ('owner', 'call-center-board', array['view', 'update'], 'all'),
  ('owner', 'call-center-agents', array['view', 'create'], 'all'),
  ('super_admin', 'call-center', array['view', 'create'], 'all'),
  ('super_admin', 'call-center-board', array['view', 'update'], 'all'),
  ('super_admin', 'call-center-agents', array['view', 'create'], 'all'),
  ('admin', 'call-center', array['view', 'create'], 'all'),
  ('admin', 'call-center-board', array['view', 'update'], 'all'),
  ('admin', 'call-center-agents', array['view', 'create'], 'all'),
  ('finance', 'call-center-board', array['view', 'update'], 'all'),
  ('milk_collection', 'call-center-board', array['view', 'update'], 'all'),
  ('warehouse', 'call-center-board', array['view', 'update'], 'all'),
  ('sales_staff', 'call-center-board', array['view', 'update'], 'all'),
  ('admin_assistant', 'call-center-board', array['view'], 'all')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.role_page_permissions (role, allowed_pages) values
  ('call_center_agent', array['/admin/call-center', '/admin/call-center/complaints']::text[]),
  ('finance', array['/admin/call-center/complaints']::text[]),
  ('milk_collection', array['/admin/call-center/complaints']::text[]),
  ('warehouse', array['/admin/call-center/complaints']::text[]),
  ('sales_staff', array['/admin/call-center/complaints']::text[]),
  ('admin_assistant', array['/admin/call-center/complaints']::text[])
on conflict (role) do update
  set allowed_pages = (
    select array(select distinct x from unnest(role_page_permissions.allowed_pages || excluded.allowed_pages) as x)
  );

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
('call-center', 'rm',
 'Call aane par caller ka khata, aaj ki rate aur doodh dekhein, aur shikayat darj karein. Agent view-only hai.',
 'Call Center Agent. Admin agent banata hai.',
 'Jab caller mobile, naam ya ID de.',
 array['Mobile, naam ya FRM/CUS code se dhoondein.','Khata ki aakhri 5 qatarein aur balance dekhein.','Shikayat ki category chunein aur Save karein.','Number caller ko SMS se jaata hai.'],
 'Complaints Board par department hal karegi.',
 array['Payment, rate ya khata khud na badlein.','Apni shikayat khud band na karein.','WhatsApp se number na bhejein.']),
('call-center', 'en',
 'Look up a caller and file a complaint. Agents cannot change khata, rates or payments.',
 'Call Center Agent. Admin creates the account directly.',
 'When a caller gives a mobile, name or party ID.',
 array['Search by mobile, name or FRM/CUS code.','Read the balance and the last 5 lines.','Pick a category and save.','The number goes by SMS only.'],
 'The assigned department closes it on the board.',
 array['Do not edit payments, rates or the ledger.','The maker cannot close their own complaint.','Do not send the number on WhatsApp.']),
('call-center', 'ur',
 'کالر کا کھاتہ دیکھیں اور شکایت درج کریں۔ ایجنٹ لکھائی نہیں کر سکتا۔',
 'کال سینٹر ایجنٹ۔ ایڈمن اکاؤنٹ بناتا ہے۔',
 'جب کالر موبائل، نام یا آئی ڈی دے۔',
 array['موبائل، نام یا کوڈ سے تلاش کریں۔','بقایا اور آخری 5 قطاریں دیکھیں۔','قسم چنیں اور محفوظ کریں۔','نمبر صرف ایس ایم ایس سے جاتا ہے۔'],
 'شکایات بورڈ پر ڈیپارٹمنٹ بند کرے گی۔',
 array['ادائیگی یا ریٹ خود نہ بدلیں۔','اپنی شکایت خود بند نہ کریں۔','واٹس ایپ پر نمبر نہ بھیجیں۔']),
('call-center-board', 'rm',
 'Saari shikayat, SLA ka rang, aur department ka band karna. Banane wala khud band nahi karta.',
 'Owner aur assigned department.',
 'Jab koi shikayat khuli ho ya SLA qareeb ho.',
 array['Open / In progress / Resolved ki ginti dekhein.','Laal SLA ka matlab waqt nikal gaya.','Apne department ki shikayat In progress ya Resolved karein.'],
 'Resolved ke baad caller ko alag se rabta department kare.',
 array['Agent ki banayi shikayat wahi agent band nahi kar sakta.','Doosre department ki shikayat band nahi hoti.']),
('call-center-board', 'en',
 'All complaints, SLA colour, and department close. The maker cannot close their own.',
 'Owner and the assigned department.',
 'When a complaint is open or the SLA is close.',
 array['Read the open, in progress and resolved counts.','Red means the SLA has passed.','Move your department complaint to in progress or resolved.'],
 'The department contacts the caller after it is resolved.',
 array['The agent who created it cannot close it.','Another department cannot close it.']),
('call-center-board', 'ur',
 'تمام شکایات، ایس ایل اے کا رنگ، اور ڈیپارٹمنٹ کا بند کرنا۔',
 'اونر اور متعلقہ ڈیپارٹمنٹ۔',
 'جب شکایت کھلی ہو۔',
 array['گنتی دیکھیں۔','سرخ رنگ کا مطلب وقت نکل گیا۔','اپنی شکایت بند کریں۔'],
 'بند ہونے کے بعد ڈیپارٹمنٹ رابطہ کرے۔',
 array['بنانے والا خود بند نہیں کر سکتا۔']),
('call-center-agents', 'rm',
 'Admin seedha agent banata hai. Koi email invite nahi. Ijazat view-only hai, edit band.',
 'Owner ya Admin.',
 'Jab naya call center banda kaam shuru kare.',
 array['Naam aur mobile likhein.','Agent banayein. Login password ek dafa screen par aata hai.','Audit mein dekhein kis ne kis ka khata kab dekha.'],
 'Agent ko Agent Console ka raasta dein.',
 array['Invite email na bhejein.','Edit / payment ki ijazat na dein.']),
('call-center-agents', 'en',
 'Admin creates the agent directly. No invite email. Permissions stay view-only.',
 'Owner or Admin.',
 'When a new call-center person starts.',
 array['Enter name and mobile.','Create the agent. The password is shown once.','Read the audit of who viewed which khata.'],
 'Send the agent to the Agent Console.',
 array['Do not send an invite.','Do not grant edit or payment.']),
('call-center-agents', 'ur',
 'ایڈمن براہ راست ایجنٹ بناتا ہے۔ دعوت نہیں۔ صرف دیکھنے کی اجازت۔',
 'اونر یا ایڈمن۔',
 'جب نیا ایجنٹ شروع کرے۔',
 array['نام اور موبائل لکھیں۔','ایجنٹ بنائیں۔ پاس ورڈ ایک بار نظر آتا ہے۔','آڈٹ دیکھیں۔'],
 'ایجنٹ کو کنسول دیں۔',
 array['دعوت نہ بھیجیں۔','لکھائی کی اجازت نہ دیں۔'])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;

comment on table public.cc_complaints is
  '625: Call center shikayat. Number CMP-000001. Channel hamesha SMS. Maker khud resolved nahi kar sakta.';
comment on table public.cc_sms_outbox is
  '625: Complaint SMS queue. Provider na ho to queued rehti hai. WhatsApp kabhi nahi.';
comment on table public.cc_lookup_audit is
  '625: Kis agent ne kis party ka khata kab, kis device se dekha.';
