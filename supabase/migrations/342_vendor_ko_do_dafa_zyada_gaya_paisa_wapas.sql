-- =====================================================================
-- AgriBridge — Migration 342: Vendor ko do dafa ZYADA gaya paisa wapas
-- =====================================================================
-- 6 September ko MB-2026-00004 par vendor ki adaigi TEEN dafa darj ho
-- gayi:
--
--     TXN-26-000041   15:32:32   Rs 30,000
--     TXN-26-000042   15:33:32   Rs 30,000
--     TXN-26-000043   15:33:45   Rs 30,000
--
-- Malik ki tasdeeq: **paisa EK dafa gaya tha** -- Rs 30,000 (Rs 24,750
-- booking ka hissa, Rs 5,250 advance). Baqi do sirf screen ki wajah se
-- darj hue: booking par adaigi charh hi nahi rahi thi, is liye safha
-- har dafa "Rs 24,750 baqi" dikhata raha.
--
-- Jarh 340 mein theek hui (wade ki guzri hui tareekh har update rok rahi
-- thi, aur code us nakami ko parhta hi nahi tha). Ye migration us se
-- hone wale NUQSAN ko theek karti hai.
--
-- Aaj ledger par: **Cash in Hand manfi Rs 88,000**. Golak mein manfi
-- paisa hota hi nahi -- ye adad khud cheekh kar bata raha hai ke kuch
-- ghalat hai.
--
-- =====================================================================
-- PURANI QATAREIN BADLI NAHI JATIN
-- =====================================================================
-- Wohi usool jo 328, 330, 336, 337 mein: post ho chuki entry par
-- database khud taala laga deta hai, aur wo taala theek hai. Durustagi
-- hamesha NAYI entry se hoti hai, taake dono nazar aayein -- jo hua wo
-- bhi, aur us ki durustagi bhi.
--
-- =====================================================================
-- RAQAM HAATH SE NAHI LIKHI JA RAHI
-- =====================================================================
-- Neeche ek bhi adad tay shuda nahi hai. Wo qatarein GINI ja rahi hain
-- jo pehli adaigi ke BAAD wali hain -- pehli rehti hai, baqi ulti hoti
-- hain. Agar kal pata chale ke chaar thin, to yehi code chaaron mein se
-- teen ulta dega.
-- =====================================================================

do $$
declare
  v_entry   uuid;
  v_year    int := extract(year from now())::int % 100;
  v_next    int;
  v_num     text;
  r         record;
  v_kul     numeric := 0;
  v_booking uuid;
  v_hissa   numeric;
begin
  if exists (select 1 from journal_entries
              where description like 'Durustagi: MB-2026-00004 par vendor ki adaigi do dafa zyada (342)%') then
    raise notice '342 pehle chal chuki hai.';
    return;
  end if;

  select id, vendor_payable into v_booking, v_hissa
    from machinery_bookings where booking_number = 'MB-2026-00004';
  if v_booking is null then
    raise notice 'MB-2026-00004 nahi mili -- kuch nahi kiya.';
    return;
  end if;

  -- Pehli adaigi rehti hai, baqi ulti hoti hain.
  create temp table zyada_entries on commit drop as
  select e.id, e.entry_number
    from journal_entries e
   where e.source_module = 'machinery_vendor_payout'
     and e.description like '%MB-2026-00004%'
     and e.description not like 'Durustagi:%'
   order by e.entry_number
  offset 1;

  if not exists (select 1 from zyada_entries) then
    raise notice 'MB-2026-00004 par koi zyada adaigi nahi mili.';
    return;
  end if;

  insert into journal_entry_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = journal_entry_counters.last_number + 1
  returning last_number into v_next;

  v_num := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

  insert into journal_entries (entry_number, entry_date, description, source_module, source_id, created_by)
  values (v_num, current_date,
    'Durustagi: MB-2026-00004 par vendor ki adaigi do dafa zyada darj ho gayi thi (342). Paisa EK dafa gaya tha — malik ki tasdeeq.',
    'finance', v_booking, null)
  returning id into v_entry;

  -- Har zyada entry ki har qatar ULTI. Adad wahan se aa rahe hain, yahan
  -- se nahi.
  for r in
    select l.account_code, l.party_type, l.party_id,
           sum(coalesce(l.debit, 0))  as kul_debit,
           sum(coalesce(l.credit, 0)) as kul_credit
      from journal_lines l
     where l.entry_id in (select id from zyada_entries)
     group by l.account_code, l.party_type, l.party_id
  loop
    insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id, memo)
    values (v_entry, r.account_code, r.kul_credit, r.kul_debit, r.party_type, r.party_id,
            'Do dafa zyada darj hui adaigi wapas');
    v_kul := v_kul + r.kul_credit;
  end loop;

  raise notice 'Rs % wapas (entry %), ulti gayi entries: %',
    v_kul, v_num, (select string_agg(entry_number, ', ') from zyada_entries);
end $$;


-- ---------------------------------------------------------------------
-- Cash Book bhi -- warna Finance ka safha aur ledger alag adad denge
-- ---------------------------------------------------------------------
-- Wohi baat jo 338 ne pakri thi: `finance_accounts.current_balance` sirf
-- `finance_transactions` se nikalta hai. Ledger ulta kar dena kaafi nahi.
--
-- EK QATAR EK STATEMENT MEIN -- ek hi INSERT...SELECT mein do (ya zyada)
-- qatarein daalna khatarnak nikla: Live par MB-2026-00004 ki 2 zyada
-- qatarein thin, aur ek sath daalne par `fn_apply_finance_transaction`
-- ka incremental update doosri qatar par pehli ka naya `current_balance`
-- nahi parh raha tha -- `fn_guard_finance_balance` ne farq pakar kar rok
-- diya (Live par 7 September, jab ye migration chali). Testing par kabhi
-- pakri nahi gayi kyunke wahan MB-2026-00004 ka ye haal kabhi bana hi
-- nahi tha. Ab har zyada qatar apne ALAG statement mein jati hai, taake
-- pehli ka balance poora settle ho jaye us se pehle ke doosri chale.
do $$
declare
  r record;
begin
  for r in
    select ft.id, ft.account_id, ft.amount
      from finance_transactions ft
     where ft.category = 'Machinery Rental - Vendor Payout'
       and ft.notes like '%MB-2026-00004%'
       and ft.id not in (
         select id from finance_transactions
          where category = 'Machinery Rental - Vendor Payout'
            and notes like '%MB-2026-00004%'
          order by created_at
          limit 1
       )
       and not exists (
         select 1 from finance_transactions x
          where x.category = 'Machinery Rental - Vendor Payout (wapas)'
            and x.notes like '%' || ft.id || '%'
       )
     order by ft.id
  loop
    insert into finance_transactions (account_id, transaction_type, category, amount, transaction_date, notes)
    values (
      r.account_id,
      'income'::finance_transaction_type,
      'Machinery Rental - Vendor Payout (wapas)',
      r.amount,
      current_date,
      'Booking MB-2026-00004 — do dafa zyada darj hui adaigi wapas (342). Asal qatar: ' || r.id
    );
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- Booking par ab wo darj ho jo waqai hua
-- ---------------------------------------------------------------------
-- Rs 30,000 diye the: Rs 24,750 is booking ka hissa, Rs 5,250 vendor ke
-- khate mein advance (wo 1120 par apni jagah para hai). Booking par sirf
-- US BOOKING ka hissa charhta hai.
--
-- Ye 340 ke BAAD hi chal sakti hai -- us se pehle wade ki guzri hui
-- tareekh is qatar ko update hone hi nahi deti thi.
update public.machinery_bookings
   set amount_paid_to_vendor = vendor_payable
 where booking_number = 'MB-2026-00004'
   and amount_paid_to_vendor = 0;
