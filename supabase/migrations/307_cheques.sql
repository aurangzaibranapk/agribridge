-- =====================================================================
-- AgriBridge — Migration 307: Cheque -- diye hue aur mile hue
-- =====================================================================
-- Aage ki tareekh ka cheque (post-dated) is karobar mein aam hai: maal
-- aaj jata hai, cheque agle mahine ki tareekh ka milta hai.
--
-- SAB SE BARI GHALTI JO YAHAN HO SAKTI HAI: us cheque ko aaj ka paisa
-- gin lena. Cheque cash nahi hai -- wo cash us din banta hai jis din
-- bank se guzarta hai, aur kabhi kabhi guzarta hi nahi (bounce).
-- Cheque milte hi usay bank mein gin lene se cash book jhooti ho jati
-- hai, aur us jhoot ka pata us din chalta hai jis din cheque wapas aata
-- hai -- yani sab se bure din.
--
-- Is liye do NAYE KHATE aa rahe hain, aur cheque un mein khaRa rehta
-- hai jab tak wo bank se guzar na jaye:
--
--   1180  Cheque mile hue (abhi bank se guzre nahi)   -- asaasa
--   2050  Cheque diye hue (abhi bank se guzre nahi)   -- zimma
--
-- Yani cheque milne par gahak ka khata to saaf ho jata hai (us ne de
-- diya), magar wo raqam BANK mein nahi jati -- wo 1180 mein khaRi
-- rehti hai. Bank ki asal ginti se yehi baat mail khati hai.
--
-- Cheque book ka hissa alag hai aur saada: kaunsi book, kaun se number
-- se kaun se number tak, aur agla number kaunsa hai. Is se ye sawal ka
-- jawab milta hai ke "cheque number 40 se 45 kahan gaye" -- jo cheque
-- ke gum hone par pehla sawal hota hai.
-- =====================================================================

insert into public.gl_accounts (code, name, account_type, normal_side, sort_order) values
('1180', 'Cheque mile hue (bank se guzre nahi)', 'asset',     'debit',  95),
('2050', 'Cheque diye hue (bank se guzre nahi)', 'liability', 'credit', 250)
on conflict (code) do update set
  name = excluded.name, account_type = excluded.account_type,
  normal_side = excluded.normal_side, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- 1. Cheque book
-- ---------------------------------------------------------------------
create table if not exists public.cheque_books (
  id uuid primary key default uuid_generate_v4(),
  finance_account_id uuid not null references public.finance_accounts(id),
  book_name text not null,
  prefix text,
  first_number int not null,
  last_number int not null,
  status text not null default 'active',
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.cheque_books drop constraint if exists chk_book_range;
alter table public.cheque_books add constraint chk_book_range
  check (first_number > 0 and last_number >= first_number);

alter table public.cheque_books drop constraint if exists chk_book_status;
alter table public.cheque_books add constraint chk_book_status check (status in ('active', 'closed'));

-- ---------------------------------------------------------------------
-- 2. Cheque
-- ---------------------------------------------------------------------
create table if not exists public.cheques (
  id uuid primary key default uuid_generate_v4(),
  -- 'issued' = hum ne diya, 'received' = hamein mila.
  direction text not null,
  cheque_number text not null,
  book_id uuid references public.cheque_books(id),
  -- Diye hue cheque par ye HAMARA bank hai; mile hue par wo bank jahan
  -- hum ne wo cheque jama karana hai.
  finance_account_id uuid not null references public.finance_accounts(id),
  party_type text,
  party_id uuid,
  party_name text,
  -- Kis khate ke badle: diye hue par aksar "supplier ko dena" (2000),
  -- mile hue par aksar "customer se lena" (1100).
  counter_account text not null references public.gl_accounts(code),
  amount numeric(14,2) not null,
  issue_date date not null,
  due_date date not null,
  status text not null default 'pending',
  cleared_on date,
  bounce_reason text,
  -- Do entries: ek darj hote waqt, ek guzarne (ya bounce) par.
  entry_id uuid references public.journal_entries(id),
  settle_entry_id uuid references public.journal_entries(id),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cheques drop constraint if exists chk_cheque_direction;
alter table public.cheques add constraint chk_cheque_direction check (direction in ('issued', 'received'));

alter table public.cheques drop constraint if exists chk_cheque_amount;
alter table public.cheques add constraint chk_cheque_amount check (amount > 0);

alter table public.cheques drop constraint if exists chk_cheque_status;
alter table public.cheques add constraint chk_cheque_status
  check (status in ('pending', 'cleared', 'bounced', 'cancelled'));

-- Cheque ki tareekh us ke likhe jane se pehle ki nahi ho sakti.
alter table public.cheques drop constraint if exists chk_cheque_dates;
alter table public.cheques add constraint chk_cheque_dates check (due_date >= issue_date);

alter table public.cheques drop constraint if exists chk_cheque_cleared;
alter table public.cheques add constraint chk_cheque_cleared
  check ((status = 'cleared') = (cleared_on is not null));

alter table public.cheques drop constraint if exists chk_cheque_bounce;
alter table public.cheques add constraint chk_cheque_bounce
  check (status <> 'bounced' or (bounce_reason is not null and length(btrim(bounce_reason)) >= 5));

-- Ek bank par ek hi cheque number do dafa nahi. Ye wo ghalti hai jo
-- haath se pakRi nahi jati aur do dafa adaigi ban jati hai.
create unique index if not exists uq_cheque_number
  on public.cheques(direction, finance_account_id, cheque_number)
  where status <> 'cancelled';

create index if not exists idx_cheque_due on public.cheques(status, due_date);
create index if not exists idx_cheque_party on public.cheques(party_type, party_id);

-- Guzar chuka cheque pathar hai.
create or replace function public.fn_cheque_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'pending' then
      raise exception 'Ye cheque (%) apne anjaam tak pahunch chuka hai. Ise mitaya nahi ja sakta — durusti ulti entry se hoti hai.', old.cheque_number;
    end if;
    return old;
  end if;

  if old.status in ('cleared', 'bounced') and new.status = 'pending' then
    raise exception 'Guzra hua ya wapas aaya cheque dobara "intezar" mein nahi jata.';
  end if;
  if old.status in ('cleared', 'bounced') and (old.amount is distinct from new.amount or old.cheque_number is distinct from new.cheque_number) then
    raise exception 'Is cheque ka faisla ho chuka hai — ab is ki raqam ya number nahi badalta.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cheque_guard on public.cheques;
create trigger trg_cheque_guard
  before update or delete on public.cheques
  for each row execute function public.fn_cheque_guard();

-- ---------------------------------------------------------------------
-- 3. Ijazat ki rok
-- ---------------------------------------------------------------------
alter table public.cheque_books enable row level security;
alter table public.cheques enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['cheque_books','cheques'] loop
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

-- ---------------------------------------------------------------------
-- 4. Feature, ijazat, menu aur madad
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.cheques', 'Cheque', 'Cheques', 'چیک',
   '/admin/finance/cheques', true, true,
   'Diye hue aur mile hue cheque, un ki tareekh, aur bank se guzarne ka intezar. Cheque cash tab banta hai jab bank se guzre.')
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
  ('manager', 'finance.cheques', array['view'], 'all'),
  ('finance', 'finance.cheques', array['view','create','edit'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('finance', 'finance.cheques', 8, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.cheques', 'rm',
  'Diye hue aur mile hue cheque -- kaunsa kis tareekh ka hai, aur kaunsa abhi bank se guzarna baqi hai.',
  'Owner, Admin aur Finance darj karte hain; Manager dekh sakta hai.',
  'Jab koi cheque mile ya diya jaye -- khaas kar aage ki tareekh ka.',
  array[
    'Cheque milne par: "Mila" chunein, bank, number, raqam aur tareekh daalein. Gahak ka khata usi waqt saaf ho jata hai.',
    'Magar wo raqam bank mein NAHI jati -- wo "Cheque mile hue" khate mein khari rehti hai.',
    'Jis din bank se guzre, us din "Guzar gaya" par nishaan lagayein -- tab raqam bank mein jati hai.',
    'Wapas aa jaye to "Bounce" chunein aur wajah likhein -- gahak ka khata dobara khul jata hai.'
  ],
  'Aaj jin cheque ki tareekh aa gayi wo upar "Aaj wale" mein nazar aate hain -- unhen bank mein jama karana aaj ka kaam hai.',
  array[
    'Cheque milte hi usay bank ka paisa gin lena. Wo cash us din banta hai jis din bank se guzarta hai — aur kabhi guzarta hi nahi.',
    'Bounce hone par cheque ki qatar mita dena. Wo mitti nahi — bounce apni jagah likha jata hai, kyunki wo us bande ke bare mein sab se ahem maloomat hai.',
    'Ek hi number ka cheque do dafa darj karna. Nizam mana kar dega — aur yehi wo ghalti hai jo haath se pakRi nahi jati aur do dafa adaigi ban jati hai.'
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
