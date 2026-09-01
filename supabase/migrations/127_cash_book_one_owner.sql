-- =====================================================================
-- AgriBridge — Migration 127: Cash book ka balance ek hi malik ka
-- =====================================================================
-- finance_accounts.current_balance ek YAAD KIYA HUA adad hai. Asal hisaab
-- finance_transactions hai: khata jitna khula tha, jama aur nikasi ka
-- jorh. Yaad kiya hua adad sirf is liye rakha jata hai ke har baar poori
-- fehrist jorhni na paRe.
--
-- 023 se ye kaam ek trigger karta aa raha hai. Magar GYARAH jagah code ne
-- yehi kaam DOBARA bhi kiya:
--
--     insert into finance_transactions ...   -- trigger ne balance hilaya
--     ...
--     update finance_accounts set current_balance = <parha> - amount
--                                            -- code ne dobara hilaya
--
-- Nateeja: Rs 1,000 ka kharcha darj karein to balance Rs 2,000 kam hota
-- tha. Chala kar dekha gaya: 0 -> trigger ke baad -1000 -> code ke apne
-- update ke baad -2000.
--
-- Ye sirf ek ghalat adad nahi. Zero-Rupee ka poora nizam isi buniyad par
-- khara hai ke "paisa kahan hai" ka jawab do jagah se aa kar barabar
-- nikle. Buniyad hi dugni ginti kar rahi ho to us ke upar ki har jaanch
-- jhooti tasalli hai.
--
-- Ek jagah aur bhi thi jo ulti taraf se kharab thi (grain-sales ka
-- bardana/mazdoori): wo balance INSERT SE PEHLE parhta tha aur baad mein
-- likh deta tha. Jawab ittefaqan theek aata tha, magar us darmiyan agar
-- kisi aur ne usi khate par kuch darj kar diya ho to wo chup chaap mit
-- jata.
--
-- Is migration ke baad ye ghalti dobara ho hi nahi sakti -- code se nahi,
-- SQL console se bhi nahi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Jo bigar chuka hai, us ka record
-- ---------------------------------------------------------------------
-- Balance seedha theek kar dena aasan hai, magar us se wo adad hamesha ke
-- liye chala jata hai jo aaj screen par likha hai -- aur malik ne wohi
-- dekha hua hai. Is liye pehle likh kar rakha jata hai ke kya tha, kya
-- hona chahiye tha, aur kitna farq tha.
create table if not exists finance_balance_repairs (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references finance_accounts(id),
  account_name text not null,
  purana_balance numeric(14,2) not null,
  naya_balance numeric(14,2) not null,
  farq numeric(14,2) not null,
  transactions_ginti integer not null,
  wajah text not null,
  repaired_at timestamptz not null default now()
);

comment on table finance_balance_repairs is
  'Jab bhi cash book ka yaad kiya hua balance asal hisaab se milaya gaya, farq yahan likha gaya -- taake wo adad gum na ho jo pehle screen par tha.';

-- ---------------------------------------------------------------------
-- 2) Asal hisaab -- ek hi jagah likha hua
-- ---------------------------------------------------------------------
create or replace function fn_finance_account_true_balance(p_account_id uuid, p_opening numeric)
returns numeric
language sql
stable
as $$
  select round(p_opening + coalesce(sum(
    case when transaction_type in ('income', 'transfer_in') then amount else -amount end
  ), 0), 2)
  from finance_transactions
  where account_id = p_account_id;
$$;

-- ---------------------------------------------------------------------
-- 3) Purani kharabi ki marammat
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_should numeric;
begin
  for r in select id, name, opening_balance, current_balance from finance_accounts loop
    v_should := fn_finance_account_true_balance(r.id, r.opening_balance);

    if round(r.current_balance, 2) <> v_should then
      insert into finance_balance_repairs (
        account_id, account_name, purana_balance, naya_balance, farq, transactions_ginti, wajah
      )
      values (
        r.id, r.name, r.current_balance, v_should, round(r.current_balance, 2) - v_should,
        (select count(*) from finance_transactions where account_id = r.id),
        'Migration 127: dohri ginti ki marammat'
      );

      update finance_accounts set current_balance = v_should where id = r.id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4) Trigger ab teenon suraton par -- daalna, badalna, mitana
-- ---------------------------------------------------------------------
-- Pehle sirf INSERT par tha. Us ka matlab ye tha ke koi qatar mita di
-- jaye to paisa cash book se gayab ho jata magar balance wahin khara
-- rehta. Aisa hota bhi tha: machinery ke vendor payout mein ledger
-- nakaam ho to qatar mita di jati hai.
create or replace function fn_apply_finance_transaction() returns trigger as $$
declare
  v_old numeric(14,2) := 0;
  v_new numeric(14,2) := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := case when old.transaction_type in ('income', 'transfer_in') then old.amount else -old.amount end;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := case when new.transaction_type in ('income', 'transfer_in') then new.amount else -new.amount end;
  end if;

  if tg_op = 'DELETE' then
    update finance_accounts set current_balance = current_balance - v_old where id = old.account_id;
    return old;
  end if;

  -- Qatar ek khate se doosre khate par le jayi gayi ho to dono hilte hain.
  if tg_op = 'UPDATE' and old.account_id is distinct from new.account_id then
    update finance_accounts set current_balance = current_balance - v_old where id = old.account_id;
    update finance_accounts set current_balance = current_balance + v_new where id = new.account_id;
  else
    update finance_accounts set current_balance = current_balance + (v_new - v_old) where id = new.account_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_finance_transaction_apply on finance_transactions;
create trigger trg_finance_transaction_apply
  after insert or update or delete on finance_transactions
  for each row execute function fn_apply_finance_transaction();

-- ---------------------------------------------------------------------
-- 5) Rok -- ab is adad ko koi apni marzi se nahi likh sakta
-- ---------------------------------------------------------------------
-- Ye rok "kaun likh raha hai" par nahi hai, "kya likh raha hai" par hai:
-- balance sirf wohi ho sakta hai jo asal hisaab se nikalta hai. Isi liye
-- ye us SQL par bhi lagti hai jo koi console se chalaye, aur us code par
-- bhi jo kal koi likhe. Kisi ke bharose par nahi.
--
-- Khata khulne ki raqam (opening_balance) badalna jaiz kaam hai, is liye
-- us par rok nahi -- us soorat mein balance khud theek kar diya jata hai.
create or replace function fn_guard_finance_balance() returns trigger as $$
declare
  v_should numeric(14,2);
begin
  if new.opening_balance is distinct from old.opening_balance then
    new.current_balance := fn_finance_account_true_balance(new.id, new.opening_balance);
    return new;
  end if;

  if new.current_balance is distinct from old.current_balance then
    v_should := fn_finance_account_true_balance(new.id, new.opening_balance);
    if round(new.current_balance, 2) <> v_should then
      raise exception
        'Cash book ka balance seedha nahi likha ja sakta. Wo khud finance_transactions se nikalta hai. Likha ja raha tha: %, asal hisaab: %. Paisa hilana ho to finance_transactions mein qatar daalein.',
        round(new.current_balance, 2), v_should;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_guard_finance_balance on finance_accounts;
create trigger trg_guard_finance_balance
  before update on finance_accounts
  for each row execute function fn_guard_finance_balance();

-- ---------------------------------------------------------------------
-- 6) Nigrani -- "aur agar phir bhi ho gaya to?"
-- ---------------------------------------------------------------------
-- Rok trigger se lagti hai, aur trigger band bhi kiya ja sakta hai. Is
-- liye rok se alag ek nazar bhi chahiye jo har roz poochhe ke dono adad
-- barabar hain ya nahi.
create or replace view v_finance_balance_check as
select
  a.id as account_id,
  a.name as account_name,
  a.account_type::text as account_type,
  a.opening_balance,
  a.current_balance as yaad_kiya_hua,
  fn_finance_account_true_balance(a.id, a.opening_balance) as asal_hisaab,
  a.current_balance - fn_finance_account_true_balance(a.id, a.opening_balance) as farq
from finance_accounts a
where a.current_balance <> fn_finance_account_true_balance(a.id, a.opening_balance);

comment on view v_finance_balance_check is
  'Khali honi chahiye. Koi qatar aaye to cash book ka yaad kiya hua balance asal hisaab se hat chuka hai.';
