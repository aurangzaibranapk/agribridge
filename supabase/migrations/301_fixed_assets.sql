-- =====================================================================
-- AgriBridge — Migration 301: Mustaqil Asaasay (Fixed Assets)
-- =====================================================================
-- Malik ka naqsha (group 4): Asset Register, Asset Categories,
-- Depreciation, Depreciation Calculation, Asset Disposal, Asset
-- Revaluation, Asset Ledger, Asset Reports.
--
-- Malik ka ek aur jumla is poore hisse ki buniyad hai:
--
--   "Operational machinery aur financial asset accounting related hain
--    magar alag alag hain. Kubota ka kaam aur booking Machinery module
--    mein rahegi. Kubota ki khareed ki qeemat, depreciation, book value
--    aur farokht Fixed Assets mein."
--
-- Is liye yahan MACHINERY KA KOI KAAM NAHI HO RAHA. Ye sirf paise ka
-- rukh hai: cheez kitne ki li, har mahine kitni ghis rahi hai, aaj
-- kitab mein kitne ki hai, aur bechne par nafa hua ya nuqsan.
--
-- CHAAR BAATEIN JIN PAR YE POORA HISSA KHARA HAI:
--
--   1. KOI ALAG LEDGER NAHI. Khareed, depreciation, dobara qeemat aur
--      farokht -- chaaron usi `journal_entries` mein jaati hain jahan
--      POS, kharid, doodh aur machinery pehle se jaati hain. Fixed
--      Assets ka apna "hisaab" banana wohi ghalti hoti jis se do jagah
--      do adad ban jate hain aur koi nahi bata sakta ke sahi kaunsa hai.
--
--   2. EK MAHINA EK DAFA. Depreciation ek hi mahine mein do dafa chal
--      jaye to kharcha do guna aur nafa kam. Is liye mahine par unique
--      taala hai, aur har asaase ka apna cursor (`depreciated_upto`)
--      hai. Cursor aage barhta hai, peeche nahi.
--
--   3. GHISAI KI HADD. Jama shuda depreciation kabhi
--      (qeemat - bachi hui qeemat) se zyada nahi ho sakti. Ye database
--      ki rok hai, code ki nahi -- warna ek din koi asaasa kitab mein
--      manfi ka ho jayega.
--
--   4. BECHA HUA ASAASA PHIR NAHI GHISTA. Farokht ke baad na
--      depreciation, na dobara farokht.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Naye khate (Chart of Accounts)
-- ---------------------------------------------------------------------
-- 1390 CONTRA khata hai: hai to asaason ki taraf, magar us ka rukh
-- credit hai aur wo asaason ko GHATATA hai. Is ke liye gl_accounts par
-- `is_contra` ka khana chahiye -- warna balance sheet us Rs 50,000 ko
-- asaason mein JAMA kar legi aur asaase do guna nazar aayenge.
alter table public.gl_accounts add column if not exists is_contra boolean not null default false;

comment on column public.gl_accounts.is_contra is
  'Ulte rukh ka khata (misal: jama shuda depreciation). Balance sheet is ka baqi apne group se GHATATI hai, jama nahi karti.';

insert into public.gl_accounts (code, name, account_type, normal_side, sort_order, is_contra) values
('1300', 'Mustaqil Asaasay — Zameen aur Imarat',        'asset',   'debit',  120, false),
('1310', 'Mustaqil Asaasay — Machinery aur Aalaat',     'asset',   'debit',  121, false),
('1320', 'Mustaqil Asaasay — Gaariyan',                 'asset',   'debit',  122, false),
('1330', 'Mustaqil Asaasay — Furniture aur Fixtures',   'asset',   'debit',  123, false),
('1340', 'Mustaqil Asaasay — Computer aur IT',          'asset',   'debit',  124, false),
('1390', 'Jama shuda Depreciation (ghatao)',            'asset',   'credit', 130, true),
('3300', 'Asaasay ki dobara qeemat (Surplus)',          'equity',  'credit', 330, false),
('4095', 'Asaasa bechne par nafa',                      'income',  'credit', 495, false),
('6200', 'Depreciation ka kharcha',                     'expense', 'debit',  660, false),
('6210', 'Asaasa bechne par nuqsan',                    'expense', 'debit',  661, false),
('6220', 'Asaase ki qeemat mein kami',                  'expense', 'debit',  662, false)
on conflict (code) do update set
  name         = excluded.name,
  account_type = excluded.account_type,
  normal_side  = excluded.normal_side,
  sort_order   = excluded.sort_order,
  is_contra    = excluded.is_contra;

-- ---------------------------------------------------------------------
-- 2. Asaason ki qismein
-- ---------------------------------------------------------------------
-- Qism har asaase ke teen khate apne sath rakhti hai. Wajah wohi hai jo
-- ledger/rules.ts mein likhi hai: khata code bees jagah bikher dena wohi
-- raasta hai jahan se "adjust kar dete hain" shuru hota hai. Yahan har
-- asaase ka khata us ki qism se aata hai, banda apne haath se nahi chunta.
create table if not exists public.asset_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  asset_account text not null references public.gl_accounts(code),
  accum_account text not null references public.gl_accounts(code),
  expense_account text not null references public.gl_accounts(code),
  default_life_months int not null default 60,
  default_method text not null default 'straight_line',
  default_rate numeric(6,3),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.asset_categories drop constraint if exists chk_asset_cat_method;
alter table public.asset_categories add constraint chk_asset_cat_method
  check (default_method in ('straight_line', 'reducing_balance'));

alter table public.asset_categories drop constraint if exists chk_asset_cat_life;
alter table public.asset_categories add constraint chk_asset_cat_life
  check (default_life_months between 1 and 1200);

-- Reducing balance bina rate ke chal hi nahi sakta.
alter table public.asset_categories drop constraint if exists chk_asset_cat_rate;
alter table public.asset_categories add constraint chk_asset_cat_rate
  check (default_method <> 'reducing_balance' or (default_rate is not null and default_rate > 0 and default_rate < 100));

insert into public.asset_categories (name, asset_account, accum_account, expense_account, default_life_months, default_method)
values
  ('Zameen aur Imarat',      '1300', '1390', '6200', 240, 'straight_line'),
  ('Machinery aur Aalaat',   '1310', '1390', '6200', 120, 'straight_line'),
  ('Gaariyan',               '1320', '1390', '6200',  60, 'straight_line'),
  ('Furniture aur Fixtures', '1330', '1390', '6200',  96, 'straight_line'),
  ('Computer aur IT',        '1340', '1390', '6200',  36, 'straight_line')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 3. Asaason ka register
-- ---------------------------------------------------------------------
create table if not exists public.fixed_assets (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  category_id uuid not null references public.asset_categories(id),
  branch_id uuid references public.branches(id),
  supplier_id uuid references public.suppliers(id),
  acquired_on date not null,
  -- Ghisai isi mahine se shuru hoti hai. Aksar wohi din hota hai jab
  -- cheez aayi, magar hamesha nahi -- machine do mahine khaRi bhi reh
  -- sakti hai.
  in_service_on date not null,
  cost numeric(14,2) not null,
  salvage_value numeric(14,2) not null default 0,
  -- Dobara qeemat lagne par asal khareed ki qeemat NAHI badalti. Farq
  -- yahan alag jama hota hai, taake do saal baad bhi ye sawal ka jawab
  -- mile ke "asal mein kitne ka liya tha".
  revaluation_adjustment numeric(14,2) not null default 0,
  life_months int not null,
  method text not null default 'straight_line',
  dep_rate numeric(6,3),
  accumulated_depreciation numeric(14,2) not null default 0,
  -- Kahan tak ghis chuka. Mahine ka pehla din. Null = abhi shuru nahi hui.
  depreciated_upto date,
  status text not null default 'active',
  serial_no text,
  location text,
  notes text,
  disposed_on date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fixed_assets drop constraint if exists chk_fa_cost;
alter table public.fixed_assets add constraint chk_fa_cost check (cost > 0);

alter table public.fixed_assets drop constraint if exists chk_fa_salvage;
alter table public.fixed_assets add constraint chk_fa_salvage
  check (salvage_value >= 0 and salvage_value < cost + revaluation_adjustment);

alter table public.fixed_assets drop constraint if exists chk_fa_life;
alter table public.fixed_assets add constraint chk_fa_life check (life_months between 1 and 1200);

alter table public.fixed_assets drop constraint if exists chk_fa_method;
alter table public.fixed_assets add constraint chk_fa_method
  check (method in ('straight_line', 'reducing_balance'));

alter table public.fixed_assets drop constraint if exists chk_fa_rate;
alter table public.fixed_assets add constraint chk_fa_rate
  check (method <> 'reducing_balance' or (dep_rate is not null and dep_rate > 0 and dep_rate < 100));

alter table public.fixed_assets drop constraint if exists chk_fa_status;
alter table public.fixed_assets add constraint chk_fa_status
  check (status in ('active', 'disposed', 'written_off'));

-- Ghisai ki hadd -- usool 3.
alter table public.fixed_assets drop constraint if exists chk_fa_accum;
alter table public.fixed_assets add constraint chk_fa_accum
  check (accumulated_depreciation >= 0 and accumulated_depreciation <= cost + revaluation_adjustment - salvage_value + 0.01);

alter table public.fixed_assets drop constraint if exists chk_fa_service_date;
alter table public.fixed_assets add constraint chk_fa_service_date
  check (in_service_on >= acquired_on);

alter table public.fixed_assets drop constraint if exists chk_fa_disposed;
alter table public.fixed_assets add constraint chk_fa_disposed
  check ((status = 'active') = (disposed_on is null));

create index if not exists idx_fa_status on public.fixed_assets(status);
create index if not exists idx_fa_category on public.fixed_assets(category_id);
create index if not exists idx_fa_branch on public.fixed_assets(branch_id);

-- Asaase ka number: FA-0001, FA-0002 ...
create table if not exists public.fixed_asset_counter (
  id int primary key default 1,
  last_number int not null default 0,
  constraint chk_fa_counter_single check (id = 1)
);
insert into public.fixed_asset_counter (id, last_number) values (1, 0) on conflict (id) do nothing;

create or replace function public.fn_next_asset_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update public.fixed_asset_counter set last_number = last_number + 1 where id = 1
  returning last_number into v_n;
  return 'FA-' || lpad(v_n::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Depreciation ka chalna (run) aur us ki qatarein
-- ---------------------------------------------------------------------
-- Ek mahine ka ek hi run. Ye usool 2 ka taala hai.
create table if not exists public.asset_depreciation_runs (
  id uuid primary key default uuid_generate_v4(),
  period date not null unique,
  status text not null default 'draft',
  total_amount numeric(14,2) not null default 0,
  entry_id uuid references public.journal_entries(id),
  computed_by uuid references auth.users(id),
  computed_at timestamptz not null default now(),
  posted_by uuid references auth.users(id),
  posted_at timestamptz
);

alter table public.asset_depreciation_runs drop constraint if exists chk_dep_run_status;
alter table public.asset_depreciation_runs add constraint chk_dep_run_status
  check (status in ('draft', 'posted'));

-- Mahine ka pehla din hi period hai. 15 tareekh ka period rakhne se do
-- run ek hi mahine ke ban sakte hain aur unique ka taala bemani ho jata.
alter table public.asset_depreciation_runs drop constraint if exists chk_dep_run_period;
alter table public.asset_depreciation_runs add constraint chk_dep_run_period
  check (period = date_trunc('month', period)::date);

alter table public.asset_depreciation_runs drop constraint if exists chk_dep_run_posted;
alter table public.asset_depreciation_runs add constraint chk_dep_run_posted
  check ((status = 'posted') = (entry_id is not null and posted_at is not null));

create table if not exists public.asset_depreciation_lines (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid not null references public.asset_depreciation_runs(id) on delete cascade,
  asset_id uuid not null references public.fixed_assets(id) on delete restrict,
  months int not null default 1,
  amount numeric(14,2) not null,
  opening_book numeric(14,2) not null,
  closing_book numeric(14,2) not null,
  expense_account text not null references public.gl_accounts(code),
  accum_account text not null references public.gl_accounts(code),
  unique (run_id, asset_id)
);

alter table public.asset_depreciation_lines drop constraint if exists chk_dep_line_amount;
alter table public.asset_depreciation_lines add constraint chk_dep_line_amount check (amount > 0);

create index if not exists idx_dep_line_asset on public.asset_depreciation_lines(asset_id);

-- Post ho chuka run pathar hai. Na badalta hai, na mitta hai -- ghalti
-- ki durusti ulti entry se hoti hai, mitane se nahi.
create or replace function public.fn_dep_run_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Ye depreciation run (% ) ledger mein ja chuka hai. Ise mitaya nahi ja sakta -- durusti ulti entry se hoti hai.', to_char(old.period, 'Mon YYYY');
    end if;
    return old;
  end if;
  if old.status = 'posted' and new.status = 'posted' and (old.entry_id is distinct from new.entry_id or old.total_amount is distinct from new.total_amount) then
    raise exception 'Post ho chuka run badla nahi ja sakta.';
  end if;
  if old.status = 'posted' and new.status = 'draft' then
    raise exception 'Post ho chuka run wapas draft nahi hota.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dep_run_immutable on public.asset_depreciation_runs;
create trigger trg_dep_run_immutable
  before update or delete on public.asset_depreciation_runs
  for each row execute function public.fn_dep_run_immutable();

-- ---------------------------------------------------------------------
-- 5. Farokht aur dobara qeemat
-- ---------------------------------------------------------------------
create table if not exists public.asset_disposals (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.fixed_assets(id) on delete restrict,
  disposed_on date not null,
  disposal_type text not null default 'sale',
  proceeds numeric(14,2) not null default 0,
  buyer_name text,
  finance_account_id uuid references public.finance_accounts(id),
  cost_at_disposal numeric(14,2) not null,
  accum_at_disposal numeric(14,2) not null,
  book_value numeric(14,2) not null,
  gain_loss numeric(14,2) not null,
  reason text,
  entry_id uuid references public.journal_entries(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Ek asaasa ek hi dafa bikta hai (usool 4).
create unique index if not exists uq_asset_disposal_once on public.asset_disposals(asset_id);

alter table public.asset_disposals drop constraint if exists chk_disposal_type;
alter table public.asset_disposals add constraint chk_disposal_type
  check (disposal_type in ('sale', 'scrap', 'written_off'));

alter table public.asset_disposals drop constraint if exists chk_disposal_proceeds;
alter table public.asset_disposals add constraint chk_disposal_proceeds check (proceeds >= 0);

-- Paisa aaya hai to kis khate mein aaya -- ye sawal khali nahi chhoRa
-- ja sakta. Warna cheez bik gayi aur paisa kahin darj nahi hua.
alter table public.asset_disposals drop constraint if exists chk_disposal_account;
alter table public.asset_disposals add constraint chk_disposal_account
  check (proceeds = 0 or finance_account_id is not null);

create table if not exists public.asset_revaluations (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.fixed_assets(id) on delete restrict,
  revalued_on date not null,
  old_carrying numeric(14,2) not null,
  new_carrying numeric(14,2) not null,
  difference numeric(14,2) not null,
  surplus_part numeric(14,2) not null default 0,
  expense_part numeric(14,2) not null default 0,
  reason text not null,
  entry_id uuid references public.journal_entries(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.asset_revaluations drop constraint if exists chk_reval_reason;
alter table public.asset_revaluations add constraint chk_reval_reason
  check (length(btrim(reason)) >= 10);

alter table public.asset_revaluations drop constraint if exists chk_reval_new;
alter table public.asset_revaluations add constraint chk_reval_new check (new_carrying >= 0);

create index if not exists idx_reval_asset on public.asset_revaluations(asset_id, revalued_on);

-- ---------------------------------------------------------------------
-- 6. Hisaab -- kitna ghisna hai
-- ---------------------------------------------------------------------
-- Ye function SIRF GINTI karta hai, ledger ko haath nahi lagata. Draft
-- run banta hai jise aadmi dekh kar post karta hai. Ye jaan boojh kar
-- do qadam hain: depreciation saal mein sab se baRa non-cash kharcha
-- hota hai, aur usay bina dekhe ledger mein chala dena wohi jagah hai
-- jahan ek ghalat life ya ghalat rate mahinon tak pakRa nahi jata.
create or replace function public.fn_asset_dep_compute(p_period date, p_user uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_run_id uuid;
  v_status text;
  a record;
  v_start date;
  v_months int;
  v_base numeric(14,2);
  v_book numeric(14,2);
  v_open numeric(14,2);
  v_amount numeric(14,2);
  v_monthly numeric(14,2);
  v_i int;
  v_step numeric(14,2);
  v_total numeric(14,2) := 0;
begin
  if v_period > date_trunc('month', current_date)::date then
    raise exception 'Aane wale mahine ki depreciation nahi chalti. Mahina guzarne dein.';
  end if;

  select id, status into v_run_id, v_status
  from public.asset_depreciation_runs where period = v_period;

  if v_status = 'posted' then
    raise exception 'Is mahine (%) ki depreciation pehle hi ledger mein ja chuki hai.', to_char(v_period, 'Mon YYYY');
  end if;

  if v_run_id is null then
    insert into public.asset_depreciation_runs (period, computed_by)
    values (v_period, p_user)
    returning id into v_run_id;
  else
    -- Draft dobara ginne par purani qatarein hat jati hain. Draft ka
    -- ledger se koi taalluq nahi, is liye yahan mitana mehfooz hai.
    delete from public.asset_depreciation_lines where run_id = v_run_id;
    update public.asset_depreciation_runs
      set computed_by = coalesce(p_user, computed_by), computed_at = now(), total_amount = 0
      where id = v_run_id;
  end if;

  for a in
    select f.*, c.expense_account, c.accum_account
    from public.fixed_assets f
    join public.asset_categories c on c.id = f.category_id
    where f.status = 'active'
      and date_trunc('month', f.in_service_on)::date <= v_period
      and (f.depreciated_upto is null or f.depreciated_upto < v_period)
  loop
    v_base := a.cost + a.revaluation_adjustment - a.salvage_value;
    v_open := a.cost + a.revaluation_adjustment - a.accumulated_depreciation;
    v_book := v_open;

    if a.accumulated_depreciation >= v_base - 0.005 then
      -- Poori ghis chuki. Cursor phir bhi aage barhta hai, warna har
      -- mahine ye asaasa dobara gina jata rahega.
      update public.fixed_assets set depreciated_upto = v_period, updated_at = now() where id = a.id;
      continue;
    end if;

    v_start := greatest(date_trunc('month', a.in_service_on)::date,
                        coalesce(a.depreciated_upto + interval '1 month', date_trunc('month', a.in_service_on)::date)::date);
    v_months := (extract(year from age(v_period, v_start)) * 12 + extract(month from age(v_period, v_start)))::int + 1;
    if v_months < 1 then continue; end if;

    v_amount := 0;
    if a.method = 'straight_line' then
      v_monthly := round(v_base / a.life_months, 2);
      v_amount := least(round(v_monthly * v_months, 2), round(v_base - a.accumulated_depreciation, 2));
    else
      -- Reducing balance: har mahine bachi hui qeemat par. Mahine ek ek
      -- kar ke gine jate hain, warna chhoote hue mahinon ka adad ghalat
      -- aata hai.
      for v_i in 1..v_months loop
        v_step := round((v_book - a.salvage_value) * (a.dep_rate / 100.0) / 12.0, 2);
        exit when v_step <= 0;
        if v_book - v_step < a.salvage_value then
          v_step := round(v_book - a.salvage_value, 2);
        end if;
        exit when v_step <= 0;
        v_amount := v_amount + v_step;
        v_book := v_book - v_step;
      end loop;
      v_amount := least(v_amount, round(v_base - a.accumulated_depreciation, 2));
    end if;

    if v_amount <= 0 then
      update public.fixed_assets set depreciated_upto = v_period, updated_at = now() where id = a.id;
      continue;
    end if;

    insert into public.asset_depreciation_lines
      (run_id, asset_id, months, amount, opening_book, closing_book, expense_account, accum_account)
    values
      (v_run_id, a.id, v_months, v_amount, v_open, v_open - v_amount, a.expense_account, a.accum_account);

    v_total := v_total + v_amount;
  end loop;

  update public.asset_depreciation_runs set total_amount = v_total where id = v_run_id;
  return v_run_id;
end;
$$;

-- Run post ho jane par: asaason ka cursor aage, jama shuda ghisai upar.
-- Ye dono kaam EK transaction mein hote hain -- alag alag karne ka
-- matlab hai ke kabhi ledger mein kharcha chala jaye aur asaase par na
-- charhe, aur us farq ka kisi ko pata bhi na chale.
create or replace function public.fn_asset_dep_mark_posted(p_run_id uuid, p_entry_id uuid, p_user uuid default null)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(14,2);
  v_period date;
  v_status text;
  l record;
begin
  select status, period, total_amount into v_status, v_period, v_total
  from public.asset_depreciation_runs where id = p_run_id for update;

  if v_status is null then raise exception 'Ye depreciation run maujood nahi.'; end if;
  if v_status = 'posted' then raise exception 'Ye run pehle hi post ho chuka hai.'; end if;
  -- Entry ke baghair "post" ka koi matlab nahi: asaason par ghisai charh
  -- jati aur ledger mein kharcha kahin darj na hota.
  if p_entry_id is null then raise exception 'Ledger ki entry ke baghair run post nahi hota.'; end if;

  for l in select * from public.asset_depreciation_lines where run_id = p_run_id loop
    update public.fixed_assets
      set accumulated_depreciation = accumulated_depreciation + l.amount,
          depreciated_upto = v_period,
          updated_at = now()
      where id = l.asset_id;
  end loop;

  update public.asset_depreciation_runs
    set status = 'posted', entry_id = p_entry_id, posted_by = p_user, posted_at = now()
    where id = p_run_id;

  return v_total;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Asaase ka ledger -- ek asaase ki poori kahani
-- ---------------------------------------------------------------------
create or replace view public.v_fixed_asset_ledger
with (security_invoker = on) as
  select f.id as asset_id, f.acquired_on as event_date, 'acquisition'::text as event_type,
         'Khareed'::text as label, f.cost as amount,
         (f.cost)::numeric(14,2) as running_carrying, null::uuid as entry_id, f.created_at
  from public.fixed_assets f
  union all
  select l.asset_id, r.period, 'depreciation', 'Depreciation — ' || to_char(r.period, 'Mon YYYY'),
         -l.amount, l.closing_book, r.entry_id, r.posted_at
  from public.asset_depreciation_lines l
  join public.asset_depreciation_runs r on r.id = l.run_id
  where r.status = 'posted'
  union all
  select v.asset_id, v.revalued_on, 'revaluation', 'Dobara qeemat: ' || v.reason,
         v.difference, v.new_carrying, v.entry_id, v.created_at
  from public.asset_revaluations v
  union all
  select d.asset_id, d.disposed_on, 'disposal',
         case d.disposal_type when 'sale' then 'Farokht' when 'scrap' then 'Kabaar' else 'Kitab se kharij' end,
         -d.book_value, 0::numeric(14,2), d.entry_id, d.created_at
  from public.asset_disposals d;

-- Register ka khulasa -- book value har jagah alag alag ginne se bachne
-- ke liye EK hi jagah se aati hai.
create or replace view public.v_fixed_assets
with (security_invoker = on) as
  select f.id, f.code, f.name, f.status, f.branch_id, f.category_id,
         c.name as category_name,
         f.acquired_on, f.in_service_on, f.cost, f.salvage_value,
         f.revaluation_adjustment, f.life_months, f.method, f.dep_rate,
         f.accumulated_depreciation, f.depreciated_upto, f.disposed_on,
         f.serial_no, f.location, f.notes,
         (f.cost + f.revaluation_adjustment)::numeric(14,2) as gross_value,
         (f.cost + f.revaluation_adjustment - f.accumulated_depreciation)::numeric(14,2) as book_value,
         c.expense_account, c.accum_account, c.asset_account
  from public.fixed_assets f
  join public.asset_categories c on c.id = f.category_id;

-- ---------------------------------------------------------------------
-- 8. Ijazat ki rok (RLS)
-- ---------------------------------------------------------------------
-- Padhna har staff ke liye khula hai (register dekhna kisi ka nuqsan
-- nahi), likhna sirf un teen ke liye jo waise bhi ledger ke zimmedar
-- hain. Likhai waise bhi server action se service client se hoti hai --
-- ye doosra taala hai, pehla nahi.
alter table public.asset_categories enable row level security;
alter table public.fixed_assets enable row level security;
alter table public.asset_depreciation_runs enable row level security;
alter table public.asset_depreciation_lines enable row level security;
alter table public.asset_disposals enable row level security;
alter table public.asset_revaluations enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['asset_categories','fixed_assets','asset_depreciation_runs',
                             'asset_depreciation_lines','asset_disposals','asset_revaluations']
  loop
    execute format('drop policy if exists staff_read_%1$s on public.%1$I', tbl);
    execute format(
      'create policy staff_read_%1$s on public.%1$I for select to authenticated using (public.fn_is_any_staff())', tbl);

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
-- 9. Feature, ijazat, menu aur madad
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.assets', 'Mustaqil Asaasay', 'Fixed Assets', 'مستقل اثاثے',
   '/admin/finance/assets', true, true,
   'Asaason ka register, un ki qismein, har mahine ki ghisai (depreciation), dobara qeemat aur farokht -- sab usi ledger mein.')
on conflict (key) do update set
  label        = excluded.label,
  label_en     = excluded.label_en,
  label_ur     = excluded.label_ur,
  route        = excluded.route,
  is_active    = true,
  is_sensitive = excluded.is_sensitive,
  description  = excluded.description;

-- Manager dekh sakta hai, chala nahi sakta. Depreciation chalana, asaasa
-- bechna aur dobara qeemat lagana -- teenon seedha nafe par asar daalte
-- hain, is liye wo finance ke haath mein hain.
insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager', 'finance.assets', array['view'], 'all'),
  ('finance', 'finance.assets', array['view','create','edit'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('finance', 'finance.assets', 3, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.assets', 'rm',
  'Wo cheezein jo bikne ke liye nahi, kaam karne ke liye khareedi gayin -- machine, gaari, computer, furniture. Yahan un ki qeemat, har mahine ki ghisai aur aaj ki kitabi qeemat rehti hai.',
  'Owner, Admin aur Finance chalate hain; Manager dekh sakta hai.',
  'Nayi machine ya gaari aane par, aur har mahine ke aakhir mein depreciation chalane ke liye.',
  array[
    'Naya asaasa: naam, qism, khareed ki tareekh, qeemat aur umar (mahine) daalein -- aur ye ke paisa cash/bank se gaya, udhaar par liya, ya pehle se apna tha.',
    'Har mahine ke aakhir mein "Depreciation" par ja kar mahina chunein aur "Hisaab lagayein" dabayein. Pehle sirf fehrist banti hai.',
    'Fehrist dekh kar "Ledger mein daalein" dabayein -- tab entry banti hai.',
    'Asaasa bik jaye ya kabaar ho jaye to us ke safhe par "Farokht / Kharij" se darj karein.'
  ],
  'Depreciation post hone ke baad Nafa Nuqsan mein "Depreciation ka kharcha" aur Balance Sheet mein asaason ki nayi qeemat khud nazar aa jati hai.',
  array[
    'Machinery module ka kaam yahan dhoondhna. Booking, kirayadari aur operator ka kaam wahin rehta hai -- yahan sirf us machine ki qeemat aur ghisai hai.',
    'Roz marra ka chhota saamaan (tools, bartan, chhoti cheezein) yahan daal dena. Wo kharcha hai; yahan sirf wo cheez aati hai jo kai saal chalti hai.',
    'Ek hi mahine ki depreciation do dafa chalane ki koshish. Nizam mana kar dega -- aur yehi theek hai, warna kharcha do guna ho jata.',
    'Bik chuke asaase ko register mein "active" rakhna. Farokht darj karte hi wo apne aap nikal jata hai aur ghisna band ho jata hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose   = excluded.purpose,
  who_uses  = excluded.who_uses,
  when_use  = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes  = excluded.mistakes,
  updated_at = now();
