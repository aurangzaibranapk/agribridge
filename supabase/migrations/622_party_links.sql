-- 622: Party links — ek hi banda customer bhi, supplier bhi (Yasir Ali: saman leta hai, diesel deta hai).
-- Sab ADDITIVE. Rollback: 622_party_links.rollback.sql
-- Malik (20 Oct 2026): "sab saaf ho, koi chhupi payment nahi."

-- 1) party_links ------------------------------------------------------------
create table if not exists public.party_links (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  customer_id     uuid not null references public.customers(id),
  supplier_id     uuid not null references public.suppliers(id),
  note            text,
  is_active       boolean not null default true,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  deactivated_by  uuid references public.profiles(id),
  deactivated_at  timestamptz,
  constraint chk_party_link_off check (is_active or deactivated_at is not null)
);
comment on table public.party_links is
  '622: Customer aur supplier ek hi banda. Sirf jorr kar DIKHATA hai; koi balance khud nahi kaatta (set-off sirf party_settlements ki manzoori se).';

create unique index if not exists party_links_active_pair
  on public.party_links (customer_id, supplier_id) where is_active;
create index if not exists party_links_customer_idx on public.party_links (customer_id) where is_active;
create index if not exists party_links_supplier_idx on public.party_links (supplier_id) where is_active;

alter table public.party_links enable row level security;
drop policy if exists party_links_staff_read on public.party_links;
create policy party_links_staff_read on public.party_links for select using (public.fn_is_any_staff());
-- Likhna sirf server action (service role) se, owner/admin/finance ki jaanch ke baad.
revoke insert, update, delete on public.party_links from anon, authenticated;
grant select on public.party_links to authenticated;

-- 2) party_settlements: do linked party (Dr 2000 supplier / Cr 1100 customer) --
alter table public.party_settlements
  add column if not exists dena_party_type text,
  add column if not exists dena_party_id   uuid,
  add column if not exists party_link_id   uuid references public.party_links(id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_settlement_linked_shape') then
    alter table public.party_settlements add constraint chk_settlement_linked_shape check (
      (party_link_id is null and dena_party_type is null and dena_party_id is null)
      or (party_link_id is not null and party_type = 'customer' and lena_khata = '1100'
          and dena_party_type = 'supplier' and dena_party_id is not null and dena_khata = '2000')
    );
  end if;
  -- Maker-checker database par: linked adjustment banane wala khud manzoor nahi kar sakta.
  if not exists (select 1 from pg_constraint where conname = 'chk_settlement_linked_maker_checker') then
    alter table public.party_settlements add constraint chk_settlement_linked_maker_checker check (
      party_link_id is null or approved_by is null or approved_by is distinct from created_by
    );
  end if;
end $$;

-- Manzoori ke baad taala: naye khane bhi band.
create or replace function public.fn_settlement_taala()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' then
    if new.amount is distinct from old.amount
       or new.lena_khata is distinct from old.lena_khata
       or new.dena_khata is distinct from old.dena_khata
       or new.party_id is distinct from old.party_id
       or new.party_type is distinct from old.party_type
       or new.dena_party_id is distinct from old.dena_party_id
       or new.dena_party_type is distinct from old.dena_party_type
       or new.party_link_id is distinct from old.party_link_id then
      raise exception 'Ye adjustment manzoor ho kar kitab mein ja chuka hai. Ab badla nahi ja sakta — ulti qatar banayein.';
    end if;
  end if;
  return new;
end;
$$;

-- 3) Kharche: nayi qism "supplier_bill_udhaar" (Dr 6xxx / Cr 2000, cash nahi hilta) --
do $$
declare v_name text;
begin
  select conname into v_name from pg_constraint
   where conrelid = 'public.company_expense_requests'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%kind = ANY%' limit 1;
  if v_name is not null then
    execute format('alter table public.company_expense_requests drop constraint %I', v_name);
  end if;
  alter table public.company_expense_requests add constraint company_expense_requests_kind_check check (kind = any (array[
    'kharcha','supplier_ko_diya','staff_ko_advance','kisan_ko_advance','mazdoor_ko_advance','mazdoori_ki_adaigi',
    'customer_se_wasooli','staff_se_wapas','kisan_se_wapas','aamdani','malik_ne_nikala','malik_ka_sarmaya',
    'supplier_bill_udhaar'
  ]::text[]));
end $$;

-- 4) Ek party ki GL qatarein (statement / Party 360 ke liye) — sirf parhna --------
create or replace function public.fn_party_gl_lines(p_party_type text, p_party_id uuid, p_accounts text[])
returns table (account_code text, debit numeric, credit numeric, entry_date date, entry_number text,
               description text, source_module text, entry_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.account_code, coalesce(l.debit,0), coalesce(l.credit,0), e.entry_date, e.entry_number,
         e.description, e.source_module, e.id
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
   where public.fn_is_any_staff()
     and l.party_type = p_party_type and l.party_id = p_party_id
     and l.account_code = any(p_accounts)
   order by e.entry_date, e.created_at;
$$;
revoke all on function public.fn_party_gl_lines(text, uuid, text[]) from public, anon;
grant execute on function public.fn_party_gl_lines(text, uuid, text[]) to authenticated, service_role;

-- 5) Feature row (sidebar/permissions ke liye), 620 wala tareeqa ---------------
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values ('party-links', 'Party Links (Customer + Supplier)', 'Party Links (Customer + Supplier)', 'پارٹی لنکس (کسٹمر + سپلائر)',
  'Aik banda customer bhi, supplier bhi — net hisaab', 'Same person as customer and supplier — net balance', 'ایک بندہ کسٹمر بھی، سپلائر بھی — نیٹ حساب',
  '/admin/party-links', 'Link2', true, true)
on conflict (key) do nothing;
insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
values ('admin', 'party-links', 'Operations', 2, 274)
on conflict (dashboard_key, feature_key) do nothing;
