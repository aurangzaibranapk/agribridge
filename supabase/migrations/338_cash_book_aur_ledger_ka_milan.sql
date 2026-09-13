-- =====================================================================
-- AgriBridge — Migration 338: Cash Book aur ledger ka milan
-- =====================================================================
-- Malik (6 September): *"jo abhi maine load kia hai wo mere Easypaisa
-- account mein shift karein."*
--
-- Ledger mein wo durustagi ho gayi (TXN-26-000039). Magar us ke baad
-- Finance ka safha khola to adad phir bhi ghalat the -- aur wajah is se
-- baRi nikli.
--
-- =====================================================================
-- MASLA: PAISE KE DO REGISTER, AUR DO RAASTE SIRF EK MEIN JATE THE
-- =====================================================================
--
--   * **Ledger** (`journal_lines`) -- har rupya do rukh se. Trial
--     Balance, P&L, Chart of Accounts sab yahin se.
--   * **Cash Book** (`finance_transactions`) -- har khate ki apni
--     qatarein. `finance_accounts.current_balance` SIRF yahan se nikalta
--     hai (127), aur `fn_guard_finance_balance` us par taala bhi lagata
--     hai: balance haath se likha ja hi nahi sakta.
--
-- Do raaste ledger mein qatar daalte the aur Cash Book ko chhoR dete the:
--
--   1. Khate se khate mein raqam le jana (`transferAccountBalance`)
--   2. Load / bill ki qatar (`createLoadTransaction`)
--
-- Aur teesra: 328/330 ki durustagi ki entries, jo seedha ledger par
-- chali thin.
--
-- Kitab hamesha barabar rehti thi -- Trial Balance kabhi kuch nahi kehta
-- tha -- magar Finance ka safha aur ledger alag adad dikhate the:
--
--     Bank Alfalah   safha 7,165   ledger 5,165   (Rs 2,000 CBA gaye the)
--     CBA Account    safha   521   ledger 1,521
--     Easypaisa      safha     0   ledger 1,020
--     QR (merchant)  safha     0   ledger    10
--
-- Malik yehi safha parhte hain. Yani ye khamosh ghalti thi: har adad
-- "sahih" lagta tha, aur koi report shikayat nahi karti thi.
--
-- =====================================================================
-- KYA HO RAHA HAI
-- =====================================================================
--
-- 1. Har khate ka farq GINA ja raha hai (ledger manfi Cash Book) aur
--    utni hi ek qatar Cash Book mein daali ja rahi hai. **Ek bhi adad
--    haath se nahi likha ja raha** -- wohi usool jo 336 aur 337 mein tha.
--
-- 2. Ledger ko CHHUA NAHI JA RAHA. Ledger sach bol raha hai; peechhe
--    Cash Book reh gaya tha. Post ho chuki entry par waise bhi taala hai
--    (`fn_no_journal_update`).
--
-- 3. Aage ke liye ek view ban raha hai -- `v_cash_book_ledger_farq` --
--    taake ye khamoshi dobara na chale. Farq ho to wo qatar nazar aati
--    hai.
--
-- Code ki taraf donon raaste isi commit mein theek hue hain
-- (`src/lib/ledger/cash-book.ts`).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Farq ki qatar -- gini hui, likhi hui nahi
-- ---------------------------------------------------------------------
do $$
declare
  r        record;
  v_kitni  int := 0;
begin
  for r in
    select fa.id,
           fa.name,
           round(coalesce(led.baqi, 0), 2) as ledger_baqi,
           round(fn_finance_account_true_balance(fa.id, fa.opening_balance), 2) as book_baqi
      from finance_accounts fa
      left join (
        select account_code, sum(coalesce(debit,0) - coalesce(credit,0)) as baqi
          from journal_lines group by account_code
      ) led on led.account_code = fa.gl_code
     where fa.gl_code is not null
  loop
    continue when abs(r.ledger_baqi - r.book_baqi) < 0.005;

    insert into finance_transactions
      (account_id, transaction_type, category, amount, transaction_date, notes)
    values (
      r.id,
      (case when r.ledger_baqi > r.book_baqi then 'income' else 'expense' end)::finance_transaction_type,
      'Ledger se milan',
      abs(r.ledger_baqi - r.book_baqi),
      current_date,
      'Cash Book ledger se peechhe reh gaya tha (338). Wajah: khate ka transfer aur load/bill ki qatarein sirf ledger mein jati thin. '
        || 'Ledger: ' || r.ledger_baqi || ', Cash Book: ' || r.book_baqi || '.'
    );

    v_kitni := v_kitni + 1;
    raise notice '% — Rs % ki qatar (ledger %, book %)',
      r.name, round(abs(r.ledger_baqi - r.book_baqi), 2), r.ledger_baqi, r.book_baqi;
  end loop;

  raise notice 'Kul % khaton ka milan hua.', v_kitni;
end $$;


-- ---------------------------------------------------------------------
-- 2) Ab ye farq chhup na sake
-- ---------------------------------------------------------------------
-- Ye view sirf tab qatarein deta hai jab waqai farq ho. Khali view ka
-- matlab hai dono register ek baat keh rahe hain.
--
-- Dhyan: "koi qatar nahi mili" aur "farq sifar hai" yahan EK HI baat
-- hai, kyunki har finance account is view se guzarta hai -- barabar
-- walon ko chhaan diya jata hai. Jis khate par `gl_code` hi nahi, wo
-- yahan aata hi nahi -- us ka ledger mein koi khata hai hi nahi.
create or replace view public.v_cash_book_ledger_farq as
select fa.id                                                             as account_id,
       fa.name,
       fa.gl_code,
       round(coalesce(led.baqi, 0), 2)                                   as ledger_baqi,
       round(fn_finance_account_true_balance(fa.id, fa.opening_balance), 2) as cash_book_baqi,
       round(coalesce(led.baqi, 0)
             - fn_finance_account_true_balance(fa.id, fa.opening_balance), 2) as farq
  from finance_accounts fa
  left join (
    select account_code, sum(coalesce(debit,0) - coalesce(credit,0)) as baqi
      from journal_lines group by account_code
  ) led on led.account_code = fa.gl_code
 where fa.gl_code is not null
   and abs(coalesce(led.baqi, 0)
           - fn_finance_account_true_balance(fa.id, fa.opening_balance)) >= 0.005;

comment on view public.v_cash_book_ledger_farq is
  'Jin khaton par Cash Book aur ledger alag adad dete hain. Khali hona hi theek hai. Qatar aa jaye to koi raasta ledger mein qatar daal raha hai magar finance_transactions mein nahi (338).';

grant select on public.v_cash_book_ledger_farq to authenticated;
