-- =====================================================================
-- AgriBridge — Migration 332: Load & Bill ka float ASAL khate par
-- =====================================================================
-- Malik ka kehna (6 September): *"load, billing waghera sab backend se
-- EK hi account se hota hai — wo hai CBA account, wahan se hota hai."*
--
-- Is ek jumle ne 323 ki do ghaltiyan zahir kar dein.
--
-- =====================================================================
-- GHALTI 1 — EK ASAL ACCOUNT KE DO BALANCE
-- =====================================================================
--
-- 323 mein float ka apna khata banaya gaya tha (1190), aur har provider
-- account ka balance us par `party_id` ke sath rakha ja raha tha.
--
-- Magar wo CBA account Finance mein PEHLE SE maujood hai --
-- "CBA Account Load/Billing", khata 1014, Rs 521. Yani ek hi asal
-- account ka paisa do jagah ginta: Finance par 1014, aur Load & Bill par
-- 1190. Dono apni jagah "theek" lagte, aur ek din wo alag ho jate.
--
-- Ye bilkul wohi ghalti hai jo aaj subah bank par pakRi gayi thi, aur
-- jis se bachne ke liye 127 aur 129 likhi gayi thin. Main ne wohi ghalti
-- dobara kar di thi -- ek naye module mein.
--
-- Ab float ka koi ALAG khata nahi. Har provider account ek ASAL finance
-- account se juRa hua hai, aur us ka float usi khate se ginta hai.
-- Nateeja: wohi paisa Money Trail, Cash Book, Bank Reconcile aur Shaam
-- ke Hisaab -- sab par ek jaisa nazar aata hai.
--
-- =====================================================================
-- GHALTI 2 — EK ACCOUNT, EK PROVIDER
-- =====================================================================
--
-- 323 mein har account kisi EK provider ka tha (Jazz ka alag, Zong ka
-- alag). Malik ki haqeeqat is ke ulat hai: **ek hi account se sab kuch
-- hota hai** -- Jazz ka load bhi, bijli ka bill bhi.
--
-- Ab `provider_id` khali reh sakta hai, aur us ka matlab hai: "ye account
-- har provider ke liye hai." Qatar par provider phir bhi likha jata hai
-- (kis network ka load gaya) -- wo sawal alag hai, aur us ka jawab bhi
-- zaroori hai.
--
-- =====================================================================
-- KUCH ZAYA NAHI HUA
-- =====================================================================
--
-- `load_accounts` abhi KHALI hai -- ek bhi account nahi bana. Is liye ye
-- durustagi aaj mumkin hai. Do din baad, jab us par paisa chal raha
-- hota, to yehi kaam bohot mehnga hota.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Ek account, sab provider
-- ---------------------------------------------------------------------
alter table public.load_accounts alter column provider_id drop not null;

comment on column public.load_accounts.provider_id is
  'Agar ye account SIRF ek provider ka ho to wo. KHALI = har provider ke liye ek hi account (malik ka CBA account aisa hi hai).';


-- ---------------------------------------------------------------------
-- 2) Float ASAL khate par
-- ---------------------------------------------------------------------
alter table public.load_accounts
  add column if not exists finance_account_id uuid references public.finance_accounts(id);

comment on column public.load_accounts.finance_account_id is
  'Wo ASAL khata jis mein is provider account ka paisa para hai (jaise CBA Account). Float usi khate se ginta hai -- koi alag balance nahi rakha jata, warna ek hi paise ke do adad ban jate hain.';


-- ---------------------------------------------------------------------
-- 3) Float ka balance -- asal khate ke GL se
-- ---------------------------------------------------------------------
-- Pehle ye 1190 par `party_id` se ginta tha. Ab us finance account ke
-- apne GL khate se ginta hai -- yani wohi adad jo Cash Book aur Money
-- Trail dikhate hain. Ek paisa, ek adad.
create or replace function public.fn_load_float_balance(p_account uuid, p_upto date default null)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_gl text;
  v numeric;
begin
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Float ka balance sirf staff dekh sakta hai.';
  end if;

  select fa.gl_code into v_gl
    from load_accounts la
    join finance_accounts fa on fa.id = la.finance_account_id
   where la.id = p_account;

  -- Asal khata juRa hi na ho to jawab NULL hai -- sifar nahi. "Balance
  -- sifar hai" aur "kis khate ka balance?" do alag baatein hain.
  if v_gl is null then
    return null;
  end if;

  select coalesce(sum(l.debit - l.credit), 0) into v
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
   where l.account_code = v_gl
     and (p_upto is null or e.entry_date <= p_upto);

  return round(coalesce(v, 0), 2);
end;
$$;

comment on function public.fn_load_float_balance(uuid, date) is
  'Provider account ka float -- us ke ASAL finance khate ke GL se. Koi alag float khata nahi, warna ek hi paise ke do adad ban jate hain (332).';


-- ---------------------------------------------------------------------
-- 4) Din ka hisaab -- wohi tabdeeli
-- ---------------------------------------------------------------------
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

  opening_float := coalesce(fn_load_float_balance(p_account, p_date - 1), 0);

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


-- ---------------------------------------------------------------------
-- 5) 1190 ab kisi kaam ka nahi
-- ---------------------------------------------------------------------
-- Mitaya nahi ja raha (khaton ka naqsha mitane ki cheez nahi), magar us
-- par saaf likh diya gaya hai ke wo istemal nahi hota -- warna kal koi
-- use dekh kar samajhta hai ke float wahan jata hai.
update public.gl_accounts
   set name = 'Provider Float — ISTEMAL NAHI (332 se pehle ka)'
 where code = '1190';
