-- =====================================================================
-- AgriBridge — Migration 323: Load & Bill Services
-- =====================================================================
-- Malik ka kehna (5 September): mobile load aur bill payment POS ka
-- hissa banein, magar "normal product sale ki tarah treat na karein --
-- kyunki is mein stock product nahi, provider account ka digital
-- balance (Float) use hota hai."
--
-- Ye baat bilkul theek hai, aur is poore module ki bunyad yehi hai.
--
-- =====================================================================
-- CHAAR FAISLE JO IS MODULE KI SHAKAL TAY KARTE HAIN
-- =====================================================================
--
-- 1. **AgriBridge LOAD BHEJTA NAHI -- DARJ KARTA HAI.**
--
--    Load Jazz/Easypaisa ki apni app se jata hai. Hamare paas un ka API
--    nahi (retailer ko aam tor par milta bhi nahi). Is liye yahan koi
--    "Confirm & Process" wala button nahi jo ye dawa kare ke us ne load
--    kar diya.
--
--    Agar button ye dawa kare aur asal mein load na jaye, to banda
--    samjhega ho gaya, customer se paisa le lega, aur load gaya hi nahi
--    hoga. Ye is poore project ki sab se mehngi ghalti hoti.
--
--    Is liye har qatar par `provider_tid` ka khana hai -- provider ki
--    apni reference, jo staff us ki app se copy karta hai. WOHI is baat
--    ka saboot hai ke load waqai gaya. Jis qatar par TID na ho wo
--    "nakaam" nahi kehlati -- wo `saboot_baqi` hoti hai. Do alag
--    cheezein: ek ka matlab hai "hua hi nahi", doosre ka "hua, magar
--    saboot nahi lagaya".
--
-- 2. **SERVICE CHARGE aur COMMISSION DO ALAG CHEEZEIN HAIN.**
--
--    Service charge wo hai jo CUSTOMER se liya (Rs 50). Ye aaj pakka
--    hai, aaj ki aamdani hai, aaj hi khate mein jata hai.
--
--    Commission wo hai jo COMPANY baad mein deti hai (Rs 30). Ye abhi
--    pakka NAHI hai. Malik ne khud likha: "agar commission immediately
--    confirm nahi hoti to system fake earning calculate na kare."
--
--    Is liye commission ka andaza (`commission_expected`) sirf DIKHAYA
--    jata hai -- khate mein nahi jata. Khate mein wo tab jata hai jab
--    provider ka statement aa kar us ki tasdeeq kar de
--    (`commission_confirmed`). Tab tak us ki halat `muntazir` rehti hai
--    -- sifar nahi, khali nahi.
--
--    Ye wohi usool hai jo is project mein pehle bhi teen dafa bacha
--    chuka hai: jis cheez ka hisaab na ho, us ke saamne adad likhna
--    jhoot hai.
--
-- 3. **FLOAT ASSET HAI, STOCK NAHI. AUR US KA BALANCE JOURNAL SE GINTA
--    HAI, KISI ALAG KHANE SE NAHI.**
--
--    Float recharge kharcha nahi -- paisa bank se float mein gaya, bas.
--
--    Har account ka apna balance alag rakhne ka aasan raasta ye hota ke
--    `load_accounts.current_float` naam ka ek khana bana dete aur har
--    qatar par us ko update karte. Wohi ghalti is project mein cash ke
--    sath ho chuki hai: alag rakha hua balance ek din asal qataron se
--    hat jata hai, aur phir do adad hote hain jin mein se koi nahi
--    jaanta kaun sa sach hai.
--
--    Is liye yahan koi `current_float` ka khana NAHI hai. Har account ka
--    float 1190 ki un qataron se ginta hai jin par us account ka naam
--    (`party_id`) likha hai. Ek hi sach: qatarein.
--
-- 4. **BILL JAMA KARNA aur BILL ADA KARNA EK LAMHA NAHI.**
--
--    Customer se Rs 5,000 le liya aur usi waqt float se ada ho gaya --
--    to seedhi baat. Magar agar provider us waqt band ho, aur paisa
--    raat ko jama ho, to us dauran wo Rs 5,000 hamare paas hai magar
--    HAMARA nahi -- wo customer ka hai jis ka bill abhi ada nahi hua.
--
--    Us lamhe ko aamdani ya float ki kami dikhana dono ghalat hain. Wo
--    ek BOJH (liability) hai -- 2060 -- aur bill ada hote hi wo bojh
--    float se utar jata hai.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Naye khate
-- ---------------------------------------------------------------------
insert into public.gl_accounts (code, name, account_type, normal_side, sort_order)
values
  ('1190', 'Provider Float (Load/Bill)',            'asset',     'debit',  1190),
  ('2060', 'Bill jama shuda — abhi ada nahi',       'liability', 'credit', 2060),
  ('4050', 'Load/Bill service charge (customer se)','income',    'credit', 4050),
  ('4055', 'Load/Bill commission (company se)',     'income',    'credit', 4055),
  ('6105', 'Float ka farq (kam / zyada)',           'expense',   'debit',  6105)
on conflict (code) do update set
  name = excluded.name, account_type = excluded.account_type,
  normal_side = excluded.normal_side;

comment on table public.gl_accounts is
  'Khaton ka naqsha. 1190 float hai (asset, stock nahi); 4050 aur 4055 jaan boojh kar alag hain -- ek pakki aamdani hai, doosri muntazir.';


-- ---------------------------------------------------------------------
-- 2) Provider aur un ke account
-- ---------------------------------------------------------------------
create table if not exists public.load_providers (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  -- 'load' = sirf mobile load | 'bill' = sirf bill | 'both'
  kind        text not null default 'load',
  -- Bill wale provider ki qism: bijli, gas, internet, postpaid, deegar.
  bill_category text,
  sort_order  int not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint chk_provider_kind check (kind = any (array['load','bill','both']))
);

create table if not exists public.load_accounts (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references public.load_providers(id),
  title         text not null,
  -- Retailer account ka apna number -- provider ki app mein jo dikhta hai.
  account_ref   text,
  branch_id     uuid references public.branches(id),
  -- Phase 18 (multi-tenant) ke liye khana abhi se. Aaj sab NULL hain.
  tenant_key    text,
  -- Shuru ka float. KHALI = abhi darj nahi hua (sifar se alag baat).
  opening_float numeric(14,2),
  opened_on     date,
  is_active     boolean not null default true,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  constraint chk_opening_float check (opening_float is null or opening_float >= 0)
);

create index if not exists idx_load_accounts_branch on public.load_accounts (branch_id) where is_active;

comment on table public.load_accounts is
  'Provider ka retailer account. Is mein "current_float" ka khana JAAN BOOJH KAR nahi hai -- balance 1190 ki qataron se ginta hai (fn_load_float_balance).';


-- ---------------------------------------------------------------------
-- 3) Float mein paisa daalna / adjustment
-- ---------------------------------------------------------------------
create table if not exists public.load_float_moves (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.load_accounts(id),
  -- 'recharge' = bank/cash se float mein paisa dala
  -- 'adjustment' = milan ka farq (wajah lazmi, manzoori lazmi)
  kind               text not null,
  amount             numeric(14,2) not null,
  -- Recharge kis khate se aaya (UBL / Cash in Hand).
  finance_account_id uuid references public.finance_accounts(id),
  reason             text,
  journal_entry_id   uuid references public.journal_entries(id),
  created_by         uuid references auth.users(id),
  approved_by        uuid references auth.users(id),
  created_at         timestamptz not null default now(),
  constraint chk_float_move_kind check (kind = any (array['recharge','adjustment'])),
  constraint chk_float_move_amount check (amount <> 0),
  -- Recharge manfi nahi hota; adjustment dono taraf ja sakta hai.
  constraint chk_recharge_positive check (kind <> 'recharge' or amount > 0),
  -- Farq ki wajah be-naam nahi rehti, aur manzoori ke baghair nahi lagti.
  constraint chk_adjustment_shape check (
    kind <> 'adjustment'
    or (length(coalesce(reason,'')) >= 5 and approved_by is not null)
  )
);

create index if not exists idx_float_moves_account on public.load_float_moves (account_id, created_at desc);


-- ---------------------------------------------------------------------
-- 4) Asal qatarein -- load aur bill
-- ---------------------------------------------------------------------
create table if not exists public.load_transactions (
  id            uuid primary key default gen_random_uuid(),
  txn_number    text not null unique,
  account_id    uuid not null references public.load_accounts(id),
  provider_id   uuid not null references public.load_providers(id),

  -- 'load' = mobile load | 'bill' = bill payment
  kind          text not null,
  bill_category text,

  -- Load par mobile number, bill par consumer/reference number.
  reference     text not null,

  -- Asal raqam -- ye AAMDANI NAHI HAI. Ye customer ka paisa hai jo
  -- provider tak ja raha hai.
  principal      numeric(14,2) not null,

  -- Customer se liya gaya extra. KHALI = kuch extra nahi liya
  -- (sifar likhne se ye farq mit jata hai ke "liya hi nahi" aur "liya
  -- magar sifar" -- doosri cheez hoti hi nahi).
  service_charge numeric(14,2),

  -- Company ki commission ka ANDAZA (qaide se nikla hua). Ye khate mein
  -- KABHI nahi jata -- sirf dikhaya jata hai.
  commission_expected numeric(14,2),
  -- Statement se tasdeeq shuda commission. Yehi khate mein jati hai.
  commission_confirmed numeric(14,2),
  commission_status text not null default 'muntazir',

  payment_method     text not null,
  finance_account_id uuid references public.finance_accounts(id),
  customer_id        uuid references public.customers(id),
  customer_name      text,

  -- Provider ki apni reference. YEHI SABOOT HAI ke kaam waqai hua.
  provider_tid  text,

  -- 'darj'       = ho gaya, saboot bhi laga
  -- 'saboot_baqi'= ho gaya, magar provider ki TID abhi nahi lagi
  -- 'nakaam'     = hua hi nahi (customer ka paisa wapas)
  -- 'wapas'      = ulta kar diya gaya
  status        text not null default 'saboot_baqi',

  -- Bill ka paisa provider tak pahunch gaya ya abhi hamare paas hai.
  -- Load par hamesha true (load fauran jata hai).
  float_settled boolean not null default true,

  journal_entry_id uuid references public.journal_entries(id),
  reversal_of      uuid references public.load_transactions(id),
  branch_id     uuid references public.branches(id),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),

  constraint chk_txn_kind check (kind = any (array['load','bill'])),
  constraint chk_txn_status check (status = any (array['darj','saboot_baqi','nakaam','wapas'])),
  constraint chk_txn_commission_status check (commission_status = any (array['muntazir','tasdeeq','nahi_mili'])),
  constraint chk_txn_payment check (payment_method = any (array['cash','bank','wallet','khata'])),
  -- Sifar rupay ka load nahi hota.
  constraint chk_txn_principal check (principal > 0),
  -- Service charge sifar likhne ka koi matlab nahi -- khali rakhein.
  constraint chk_txn_service_charge check (service_charge is null or service_charge > 0),
  constraint chk_txn_commission check (
    (commission_expected is null or commission_expected >= 0)
    and (commission_confirmed is null or commission_confirmed >= 0)
  ),
  -- Tasdeeq shuda kehna magar adad na hona -- ye aadhi baat hai.
  constraint chk_txn_commission_shape check (
    commission_status <> 'tasdeeq' or commission_confirmed is not null
  ),
  -- Khate wali adaigi bina customer ke nahi hoti -- warna udhaar kis ke
  -- naam likha jayega.
  constraint chk_txn_khata_needs_customer check (
    payment_method <> 'khata' or customer_id is not null
  )
);

create index if not exists idx_load_txn_created on public.load_transactions (created_at desc);
create index if not exists idx_load_txn_account on public.load_transactions (account_id, created_at desc);
create index if not exists idx_load_txn_ref on public.load_transactions (reference);
create index if not exists idx_load_txn_saboot on public.load_transactions (created_at desc)
  where status = 'saboot_baqi';

comment on column public.load_transactions.principal is
  'Load/bill ki asal raqam. YE AAMDANI NAHI -- customer ka paisa hai jo provider tak ja raha hai. Aamdani sirf service_charge aur (tasdeeq ke baad) commission hai.';
comment on column public.load_transactions.provider_tid is
  'Provider ki apni reference/TID -- staff us ki app se copy karta hai. Yehi is baat ka saboot hai ke kaam waqai hua. Khali ho to qatar "saboot_baqi" rehti hai.';
comment on column public.load_transactions.commission_expected is
  'Qaide se nikla hua ANDAZA. Khate mein kabhi nahi jata -- sirf dikhaya jata hai.';


-- ---------------------------------------------------------------------
-- 5) Commission ke qaide
-- ---------------------------------------------------------------------
create table if not exists public.load_commission_rules (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid not null references public.load_providers(id),
  kind         text not null,
  -- 'fisad' = percentage | 'fixed' = har transaction par itne rupay
  mode         text not null,
  value        numeric(10,3) not null,
  from_date    date not null default current_date,
  is_active    boolean not null default true,
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  constraint chk_rule_kind check (kind = any (array['load','bill'])),
  constraint chk_rule_mode check (mode = any (array['fisad','fixed'])),
  constraint chk_rule_value check (value > 0)
);

comment on table public.load_commission_rules is
  'Commission ka ANDAZA lagane ke liye. Ye qaida khate mein kuch nahi daalta -- asal commission provider ke statement se aati hai. Slab wala qaida abhi nahi bana.';


-- ---------------------------------------------------------------------
-- 6) Shaam ka milan
-- ---------------------------------------------------------------------
create table if not exists public.load_reconciliations (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.load_accounts(id),
  tareekh          date not null,
  opening_float    numeric(14,2) not null,
  float_added      numeric(14,2) not null default 0,
  load_principal   numeric(14,2) not null default 0,
  bill_principal   numeric(14,2) not null default 0,
  adjustments      numeric(14,2) not null default 0,
  expected_closing numeric(14,2) not null,
  -- Provider ki app se dekh kar likha gaya asal balance. KHALI = abhi
  -- dekha nahi gaya -- "sifar" nahi.
  actual_closing   numeric(14,2),
  farq             numeric(14,2),
  reason           text,
  -- 'khula' = actual abhi nahi likha | 'mila' = farq sifar
  -- 'farq' = farq hai, wajah likhi | 'manzoor' = farq khate mein chala gaya
  status           text not null default 'khula',
  journal_entry_id uuid references public.journal_entries(id),
  created_by       uuid references auth.users(id),
  approved_by      uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  unique (account_id, tareekh),
  constraint chk_recon_status check (status = any (array['khula','mila','farq','manzoor'])),
  -- Farq ho to wajah lazmi. Malik ka usool: "Rs 1 ka farq ho sakta hai,
  -- lekin Rs 1 unexplained nahi rehna chahiye."
  constraint chk_recon_reason check (
    coalesce(farq, 0) = 0 or length(coalesce(reason,'')) >= 5
  )
);

comment on table public.load_reconciliations is
  'Roz ka milan. actual_closing KHALI reh sakta hai -- us ka matlab "abhi dekha nahi gaya" hai, "sifar" nahi.';


-- ---------------------------------------------------------------------
-- 7) Qatar ka number
-- ---------------------------------------------------------------------
create table if not exists public.load_txn_counters (
  year int not null,
  kind text not null,
  last_number int not null default 0,
  primary key (year, kind)
);

create or replace function public.fn_next_load_number(p_kind text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_year int := extract(year from now())::int % 100;
  v_next int;
  v_pre  text := case when p_kind = 'bill' then 'BP' else 'LD' end;
begin
  insert into load_txn_counters (year, kind, last_number)
  values (v_year, p_kind, 1)
  on conflict (year, kind) do update set last_number = load_txn_counters.last_number + 1
  returning last_number into v_next;

  return v_pre || '-' || (2000 + v_year)::text || '-' || lpad(v_next::text, 5, '0');
end;
$$;


-- ---------------------------------------------------------------------
-- 8) Float ka balance -- SIRF journal se
-- ---------------------------------------------------------------------
-- SECURITY DEFINER jaan boojh kar: RLS ke peeche khali jawab ko "float
-- sifar hai" samajh lena is project mein pehle bhi ghalat adad de chuka
-- hai. Jise ijazat nahi, use inkaar milta hai -- sifar nahi.
create or replace function public.fn_load_float_balance(p_account uuid, p_upto date default null)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v numeric;
begin
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Float ka balance sirf staff dekh sakta hai.';
  end if;

  select coalesce(sum(l.debit - l.credit), 0) into v
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
   where l.account_code = '1190'
     and l.party_type = 'load_account'
     and l.party_id = p_account
     and (p_upto is null or e.entry_date <= p_upto);

  return round(coalesce(v, 0), 2);
end;
$$;

comment on function public.fn_load_float_balance(uuid, date) is
  'Ek provider account ka float -- seedha journal ki qataron se. Koi alag rakha hua balance nahi, is liye do adad ban hi nahi sakte.';


-- Ek din ka poora hisaab -- milan ka safha isi se banta hai.
create or replace function public.fn_load_day_summary(p_account uuid, p_date date)
returns table (
  opening_float   numeric,
  float_added     numeric,
  adjustments     numeric,
  load_principal  numeric,
  bill_principal  numeric,
  service_charge  numeric,
  expected_closing numeric,
  txn_count       int,
  saboot_baqi     int
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Ye hisaab sirf staff dekh sakta hai.';
  end if;

  opening_float := fn_load_float_balance(p_account, p_date - 1);

  select coalesce(sum(case when m.kind = 'recharge' then m.amount else 0 end), 0),
         coalesce(sum(case when m.kind = 'adjustment' then m.amount else 0 end), 0)
    into float_added, adjustments
    from load_float_moves m
   where m.account_id = p_account
     and m.created_at::date = p_date;

  select coalesce(sum(case when t.kind = 'load' then t.principal else 0 end), 0),
         coalesce(sum(case when t.kind = 'bill' and t.float_settled then t.principal else 0 end), 0),
         coalesce(sum(t.service_charge), 0),
         count(*)::int,
         count(*) filter (where t.status = 'saboot_baqi')::int
    into load_principal, bill_principal, service_charge, txn_count, saboot_baqi
    from load_transactions t
   where t.account_id = p_account
     and t.created_at::date = p_date
     and t.status in ('darj', 'saboot_baqi');

  expected_closing := round(
    opening_float + float_added + adjustments - load_principal - bill_principal, 2);

  return next;
end;
$$;

comment on function public.fn_load_day_summary(uuid, date) is
  'Ek din ka float ka hisaab. Bill ka wo paisa jo abhi provider tak nahi pahuncha (float_settled = false) yahan nahi ginta -- wo abhi hamare paas hai, 2060 par.';


-- ---------------------------------------------------------------------
-- 9) RLS
-- ---------------------------------------------------------------------
alter table public.load_providers        enable row level security;
alter table public.load_accounts         enable row level security;
alter table public.load_float_moves      enable row level security;
alter table public.load_transactions     enable row level security;
alter table public.load_commission_rules enable row level security;
alter table public.load_reconciliations  enable row level security;

-- Parhna har staff ke liye (POS wale ko float dikhna chahiye). Likhna
-- sirf service client se -- har qatar ke sath journal banti hai, aur
-- seedhi SQL se qatar banane ka matlab hota hai journal ke baghair
-- paisa hilna.
do $$
declare t text;
begin
  foreach t in array array[
    'load_providers','load_accounts','load_float_moves',
    'load_transactions','load_commission_rules','load_reconciliations'
  ] loop
    execute format('drop policy if exists staff_read_%s on public.%I', t, t);
    execute format(
      'create policy staff_read_%s on public.%I for select using (public.fn_is_any_staff())', t, t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 10) Shuru ke provider
-- ---------------------------------------------------------------------
insert into public.load_providers (key, name, kind, bill_category, sort_order)
values
  ('jazz',      'Jazz',            'load', null,         10),
  ('zong',      'Zong',            'load', null,         20),
  ('ufone',     'Ufone',           'load', null,         30),
  ('telenor',   'Telenor',         'load', null,         40),
  ('easypaisa', 'Easypaisa',       'both', null,         50),
  ('jazzcash',  'JazzCash',        'both', null,         60),
  ('ubl-omni',  'UBL Omni',        'both', null,         70),
  ('bijli',     'Bijli ka bill',   'bill', 'electricity', 80),
  ('gas',       'Gas ka bill',     'bill', 'gas',         90),
  ('internet',  'Internet / PTCL', 'bill', 'internet',   100),
  ('postpaid',  'Mobile postpaid', 'bill', 'postpaid',   110)
on conflict (key) do update set
  name = excluded.name, kind = excluded.kind,
  bill_category = excluded.bill_category, sort_order = excluded.sort_order;
