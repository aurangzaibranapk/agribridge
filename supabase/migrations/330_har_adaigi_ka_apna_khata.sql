-- =====================================================================
-- AgriBridge — Migration 330: Har adaigi ke tareeqe ka apna khata
-- =====================================================================
-- Malik ka kehna (6 September): *"backend par sab ke alag alag account
-- hone chahiyein. Hamein shaam ke time check karna hota hai — cash kitna,
-- QR kitna, Easypaisa kitna, JazzCash kitna, bank kitna. Us se sab
-- maloom ho jayega, phir total nikal aayega."*
--
-- =====================================================================
-- JO MILA — CHHE TAREEQON KA KHATA THA HI NAHI
-- =====================================================================
--
--   cash            → Cash in Hand      ✅
--   bank_transfer   → Bank Alfalah      ✅
--   card            → (khali)
--   easypaisa       → (khali)
--   jazzcash        → (khali)
--   qr              → (khali)
--   Cash / Bank Transfer / Online Payment  → purane naam, aadhe khali
--
-- Jis tareeqe ka khata na ho, us ka paisa **Suspense (9999)** mein girta
-- hai. Live par wohi Rs 30 pare the: Rs 20 easypaisa, Rs 10 QR. Abhi wo
-- chhoti raqam hai kyunki ye tareeqe naye hain -- magar jis din ek din
-- ka QR ka kaam pachas hazaar ka hoga, us din bhi wo Suspense mein hi
-- girta.
--
-- Aur asal nuqsan Suspense ka nahi -- ye hai ke SHAAM KO MILAN HO HI
-- NAHI SAKTA THA: JazzCash ki app kuch kehti aur nizam mein us ka koi
-- khana hi nahi hota.
--
-- =====================================================================
-- TEEN FAISLE
-- =====================================================================
--
-- 1. **QR ka apna khata, kisi wallet ke andar nahi.**
--    Counter par staff "QR" dabata hai -- alag khana. Shaam ko wo wohi
--    ginta hai jo us ne dabaya. Agar QR ka paisa JazzCash ke andar daal
--    dete to staff ko har roz apne zehen mein QR aur JazzCash alag karne
--    parte, aur wohi jagah hai jahan ginti ghalat hoti hai.
--
--    (Agar aage chal kar maloom ho ke QR ka paisa waqai JazzCash ki app
--    ke andar hi aata hai, to do khaton ko milana chhota kaam hai. Ulta
--    -- ek mile hue khate ko todna -- bohot mushkil hota hai.)
--
-- 2. **Kisan Card ka apna khata.**
--    Pehle "Card" likha tha aur us ka paisa bank par jane wala tha.
--    Malik ne durust kiya: ye aam debit/credit card nahi -- ye **Kisan
--    Card** hai, aur us ki adaigi apne alag khate mein jati hai.
--
--    Farq mamooli nahi: bank ka card do din baad bank mein settle hota
--    hai, magar Kisan Card kisan ka apna khata hai. Us ko bank mein
--    milane se do sawal hamesha ke liye gum ho jate: "Kisan Card par
--    kitna chala" aur "bank mein waqai kitna aaya".
--
-- 3. **Purane naam mitaye nahi -- unhen bhi khata diya.**
--    `Cash`, `Bank Transfer`, `Online Payment` -- ye purane roop hain jo
--    shayad kisi purane safhe se aate hon. Inhen mita dena us safhe ka
--    paisa Suspense mein daal deta. Is liye inhen bhi wahi khata diya
--    gaya jo un ke naye roop ka hai.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Naye khate
-- ---------------------------------------------------------------------
insert into public.gl_accounts (code, name, account_type, normal_side, sort_order)
values
  ('1016', 'Wallet — saatwan khata',  'asset', 'debit', 1016),
  ('1017', 'Wallet — aathwan khata',  'asset', 'debit', 1017),
  ('1018', 'Wallet — nawan khata',    'asset', 'debit', 1018)
on conflict (code) do nothing;

update public.gl_accounts set name = 'Wallet — JazzCash'  where code = '1015';
update public.gl_accounts set name = 'Wallet — Easypaisa' where code = '1016';
update public.gl_accounts set name = 'Wallet — QR'        where code = '1017';
update public.gl_accounts set name = 'Kisan Card'         where code = '1018';


-- ---------------------------------------------------------------------
-- 2) Teen naye finance account (agar pehle se na hon)
-- ---------------------------------------------------------------------
-- Shuruati balance sifar hai, aur us ki KOI LEDGER ENTRY NAHI banayi
-- gayi. Ye farq ahem hai:
--
--   * Agar sifar likh kar us ki entry bhi bana dete, to nizam ye DAWA
--     karta ke "dekh liya, in khaton mein kuch nahi hai."
--   * Sirf khana banane se dono taraf sifar khare hain aur koi dawa nahi
--     hota. In khaton mein abhi kitna para hai, ye sirf malik us app
--     mein dekh kar bata sakte hain.
--
-- Pehle shaam ke milan par asal adad darj hoga -- aur wo farq ki soorat
-- mein saamne aayega, wajah ke saath. (`opening_balance` khali nahi reh
-- sakta -- us par database ki rok hai -- is liye sifar rakha gaya.)
insert into public.finance_accounts (name, account_type, gl_code, opening_balance, current_balance, is_active)
select 'JazzCash (merchant)', 'mobile_wallet', '1015', null, 0, true
where not exists (select 1 from finance_accounts where name = 'JazzCash (merchant)');

insert into public.finance_accounts (name, account_type, gl_code, opening_balance, current_balance, is_active)
select 'Easypaisa (merchant)', 'mobile_wallet', '1016', null, 0, true
where not exists (select 1 from finance_accounts where name = 'Easypaisa (merchant)');

insert into public.finance_accounts (name, account_type, gl_code, opening_balance, current_balance, is_active)
select 'QR (merchant)', 'mobile_wallet', '1017', null, 0, true
where not exists (select 1 from finance_accounts where name = 'QR (merchant)');

insert into public.finance_accounts (name, account_type, gl_code, opening_balance, current_balance, is_active)
select 'Kisan Card', 'mobile_wallet', '1018', null, 0, true
where not exists (select 1 from finance_accounts where name = 'Kisan Card');


-- ---------------------------------------------------------------------
-- 3) Har tareeqe ko us ka khata
-- ---------------------------------------------------------------------
do $$
declare
  v_cash uuid; v_alfalah uuid; v_jazz uuid; v_easy uuid; v_qr uuid; v_kisan uuid;
begin
  select id into v_cash    from finance_accounts where name = 'Cash in Hand' limit 1;
  select id into v_alfalah from finance_accounts where name = 'Bank Alfalah' limit 1;
  select id into v_jazz    from finance_accounts where name = 'JazzCash (merchant)' limit 1;
  select id into v_easy    from finance_accounts where name = 'Easypaisa (merchant)' limit 1;
  select id into v_qr      from finance_accounts where name = 'QR (merchant)' limit 1;
  select id into v_kisan   from finance_accounts where name = 'Kisan Card' limit 1;

  -- Sirf wo qatarein jin ka khata KHALI hai. Jo pehle se lagi hui hai
  -- use nahi chhera ja raha -- shayad malik ne khud lagayi ho.
  update payment_method_account_map set finance_account_id = v_jazz
   where payment_method = 'jazzcash' and finance_account_id is null and v_jazz is not null;

  update payment_method_account_map set finance_account_id = v_easy
   where payment_method = 'easypaisa' and finance_account_id is null and v_easy is not null;

  update payment_method_account_map set finance_account_id = v_qr
   where payment_method = 'qr' and finance_account_id is null and v_qr is not null;

  -- Kisan Card ka apna khata (malik ki tasdeeq se) -- bank par nahi.
  update payment_method_account_map set finance_account_id = v_kisan
   where payment_method = 'card' and finance_account_id is null and v_kisan is not null;

  -- Purane roop -- inhen bhi khata, warna un ka paisa Suspense mein.
  update payment_method_account_map set finance_account_id = v_cash
   where payment_method = 'Cash' and finance_account_id is null and v_cash is not null;

  update payment_method_account_map set finance_account_id = v_alfalah
   where payment_method = 'Online Payment' and finance_account_id is null and v_alfalah is not null;
end $$;


-- ---------------------------------------------------------------------
-- 4) Suspense ke Rs 30 apne khaton par
-- ---------------------------------------------------------------------
-- Wohi usool jo 328 mein: qatarein BADLI nahi jatin, durustagi ki entry
-- banti hai. Post ho chuki entry par database khud rok laga deta hai --
-- aur wo rok theek hai.
do $$
declare
  v_entry uuid;
  v_year  int := extract(year from now())::int % 100;
  v_next  int;
  v_num   text;
  v_easy  numeric := 0;
  v_qr    numeric := 0;
begin
  if exists (select 1 from journal_entries where description like 'Suspense se adaigi ke khaton par (330)%') then
    return;
  end if;

  -- Har raqam apni asal qatar se -- koi adad haath se nahi likha gaya.
  select coalesce(sum(l.debit - l.credit), 0) into v_easy
    from journal_lines l
   where l.account_code = '9999' and l.memo ilike '%easypaisa%';

  select coalesce(sum(l.debit - l.credit), 0) into v_qr
    from journal_lines l
   where l.account_code = '9999' and l.memo ilike '%qr%';

  if v_easy = 0 and v_qr = 0 then return; end if;

  insert into journal_entry_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = journal_entry_counters.last_number + 1
  returning last_number into v_next;

  v_num := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

  insert into journal_entries (entry_number, entry_date, description, source_module, created_by)
  values (v_num, current_date, 'Suspense se adaigi ke khaton par (330)', 'finance', null)
  returning id into v_entry;

  if v_easy <> 0 then
    insert into journal_lines (entry_id, account_code, debit, credit, memo)
    values (v_entry, '1016', v_easy, 0, 'POS — easypaisa (Suspense se apne khate par)');
  end if;

  if v_qr <> 0 then
    insert into journal_lines (entry_id, account_code, debit, credit, memo)
    values (v_entry, '1017', v_qr, 0, 'POS — QR (Suspense se apne khate par)');
  end if;

  insert into journal_lines (entry_id, account_code, debit, credit, memo)
  values (v_entry, '9999', 0, v_easy + v_qr, 'Adaigi ke khaton par bheji gayi raqam');
end $$;
