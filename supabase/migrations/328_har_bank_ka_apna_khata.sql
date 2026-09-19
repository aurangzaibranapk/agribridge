-- =====================================================================
-- AgriBridge — Migration 328: Har bank ka APNA khata
-- =====================================================================
-- Malik ne Bank Reconcile ka safha dikha kar poocha: *"ye kaise khatam
-- hoga farq?"* Safhe par Rs 26,515 ka farq khaRa tha, aur chaaron bank
-- ke saamne Rs 0 likha tha.
--
-- Safha khud apni majboori likh raha tha:
--
--   "har bank ka alag nahi -- kyunki ledger mein teenon banks ek hi
--    khate (1010) mein jate hain."
--
-- Yani kisi EK bank ko us ke apne statement se milana MUMKIN HI NAHI
-- THA. Farq khatam hi nahi ho sakta tha, chahe kitni hi mehnat ki
-- jati -- kyunki sawal hi ghalat poocha ja raha tha: "sab bank mila kar
-- kitna hai" ka jawab kisi ek bank ki statement se kabhi nahi milta.
--
-- =====================================================================
-- LIVE PAR JO MILA (5 qatarein 1010 par, 3 Suspense par)
-- =====================================================================
--
--   TXN-26-000001   −11,370   Diesel MB-2026-00002   (UBL se gaya)
--   TXN-26-000007   +19,000   MB-2026-00006 advance  (asal mein CASH tha)
--   TXN-26-000026    +7,165   Shuruati balance — Bank Alfalah
--   TXN-26-000028   +11,370   Shuruati balance — UBL
--   TXN-26-000029      +350   Shuruati balance — HBL
--   ----------------------------------------------------------------
--   1010 ka jama      26,515
--
--   9999 (Suspense)
--   TXN-26-000027      +521   Shuruati balance — CBA Account (gl_code khali tha)
--   TXN-26-000011       +20   POS — easypaisa
--   TXN-26-000024       +10   POS — qr
--
-- Aur "Al Rana Traders (kisan dukan)" ka Rs 2,030 ledger mein tha hi
-- NAHI -- wo sirf finance_accounts ke khane mein para tha. Ye wohi
-- purani ghalti hai: alag rakha hua balance ledger se hat jata hai aur
-- phir do adad ban jate hain jin mein se koi nahi jaanta kaun sa sach
-- hai.
--
-- =====================================================================
-- TEEN FAISLE
-- =====================================================================
--
-- 1. **1010 ek khata nahi, ek QATAR hai (1010-1019).**
--    Code mein paanch jagah "1010" ko "the bank" maan kar likha hua tha
--    (Money Trail, handover, reports, bank reconcile). Sirf naye khate
--    bana dene se wo paanch jagahein naye bank GINNA BAND kar detin --
--    yani masla theek karte karte ek naya masla ban jata: paisa kitab
--    mein hota magar Money Trail par nazar na aata. Is liye har us jagah
--    ab poori qatar parhi jati hai.
--
-- 2. **Rs 19,000 ka advance cash tha, bank nahi.**
--    Malik ne khud tasdeeq ki. Wo ghalti se 1010 par likha gaya tha. Ab
--    wo Cash in Hand (1000) par ja raha hai -- aur us ka cash book wala
--    indraj bhi ban raha hai, kyunki wo bana hi nahi tha. Sirf ledger
--    theek karna aadha kaam hota: golak ka adad phir bhi ghalat rehta.
--
-- 3. **Purani qatarein MITAYI nahi gayin -- un ka khata badla gaya.**
--    Raqam, tareekh, wajah, sab waisi ki waisi hai. Sirf ye theek hua ke
--    kaunse khate mein baithi hai. Reversal is jagah ghalat hota: waqia
--    ghalat nahi tha, sirf us ka pata ghalat likha gaya tha.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Naye khate (dhaancha -- har jagah chalta hai)
-- ---------------------------------------------------------------------
insert into public.gl_accounts (code, name, account_type, normal_side, sort_order)
values
  ('1011', 'Bank — doosra khata',  'asset', 'debit', 1011),
  ('1012', 'Bank — teesra khata',  'asset', 'debit', 1012),
  ('1013', 'Bank — chautha khata', 'asset', 'debit', 1013),
  ('1014', 'Bank — paanchwan khata','asset','debit', 1014),
  ('1015', 'Bank — chhata khata',  'asset', 'debit', 1015)
on conflict (code) do nothing;

comment on table public.gl_accounts is
  'Khaton ka naqsha. Bank 1010 se 1019 tak -- har bank ka apna, warna kisi ek bank ko us ke statement se milana mumkin nahi hota.';


-- ---------------------------------------------------------------------
-- 2) Har account ko us ka apna khata (naam se milaa kar)
-- ---------------------------------------------------------------------
-- Naam se milaya ja raha hai, id se nahi -- id har database mein alag
-- hoti hai. Jahan wo naam na ho, wahan ye qatarein khamoshi se kuch
-- nahi karengi (Testing par sirf teen bank hain).
--
-- Shart `gl_code is null or gl_code = '1010'` jaan boojh kar hai: jis
-- account ko pehle se apna khata mil chuka ho, us ko dobara na chhera
-- jaye. Is se ye migration dobara chalane par bhi mehfooz rehti hai.

update public.finance_accounts set gl_code = '1010'
 where name = 'UBL' and (gl_code is null or gl_code = '1010');

update public.finance_accounts set gl_code = '1011'
 where name = 'Bank Alfalah' and (gl_code is null or gl_code = '1010');

update public.finance_accounts set gl_code = '1012'
 where name = 'HBL' and (gl_code is null or gl_code = '1010');

update public.finance_accounts set gl_code = '1013'
 where name = 'Al Rana Traders (kisan dukan)' and (gl_code is null or gl_code = '1010');

update public.finance_accounts set gl_code = '1014'
 where name = 'CBA Account Load/Billing' and (gl_code is null or gl_code = '1010');

-- Khaton ke naam ab asal naam par
update public.gl_accounts set name = 'Bank — UBL'                          where code = '1010';
update public.gl_accounts set name = 'Bank — Alfalah'                      where code = '1011';
update public.gl_accounts set name = 'Bank — HBL'                          where code = '1012';
update public.gl_accounts set name = 'Bank — Al Rana Traders (kisan dukan)' where code = '1013';
update public.gl_accounts set name = 'Bank — CBA Account (Load/Billing)'   where code = '1014';


-- ---------------------------------------------------------------------
-- 3) Purani qatarein: DURUSTAGI KI ENTRY -- badalna nahi
-- ---------------------------------------------------------------------
-- Pehli koshish mein maine `update journal_lines set account_code = ...`
-- likha tha -- yani qatar ko utha kar doosre khate par rakh dena.
--
-- **Database ne wo rok diya**, aur theek rok diya:
--
--     "Post ho chuki entry badli nahi ja sakti. Reversal entry banayein."
--
-- Ye rok 106 mein lagayi gayi thi, is jumle ke sath: *"raqam chupke se
-- badal dena delete se bhi zyada khatarnak hai: trial balance phir bhi
-- barabar rehta hai, is liye kisi ko pata hi nahi chalta."* Agar main wo
-- update chala leta to Live ka ledger to theek dikhta, magar us mein ye
-- nishan kahin na hota ke qatarein hili thin -- aur agle mahine koi
-- poochta ke "ye raqam yahan kaise aayi" to jawab kisi ke paas na hota.
--
-- Is liye ab wohi kaam SAAF tareeqe se: ek durustagi ki entry, jo purani
-- qataron ko chhoti nahi -- sirf raqam ko us ke asal khate par le jati
-- hai. Purani entry apni jagah rehti hai, nayi entry us ke saath khaRi
-- hoti hai, aur dono mila kar poori kahani banti hai.
--
--   Dr 1011 Alfalah      7,165  ← 1010 se
--   Dr 1012 HBL            350  ← 1010 se
--   Dr 1014 CBA            521  ← 9999 (Suspense) se
--   Dr 1000 Cash        19,000  ← 1010 se (malik: "cash mein aaya tha")
--       Cr 1010 UBL             26,515
--       Cr 9999 Suspense           521
--
-- Ye ek hi entry hai kyunki waqia bhi ek hi hai: khaton ki durustagi.
do $$
declare
  v_entry uuid;
  v_year  int := extract(year from now())::int % 100;
  v_next  int;
  v_num   text;
  v_alfalah numeric := 0;
  v_hbl     numeric := 0;
  v_cba     numeric := 0;
  v_cash    numeric := 0;
  v_from1010 numeric;
begin
  -- Dobara chalane par dobara na bane.
  if exists (select 1 from journal_entries where description like 'Khaton ki durustagi — har bank ka apna khata%') then
    return;
  end if;

  -- Har qatar apni asal entry se -- yahan koi adad haath se nahi likha
  -- gaya. Jo entry maujood na ho, us ka hissa sifar reh jata hai aur
  -- entry us ke baghair bhi barabar rehti hai.
  select coalesce(sum(l.debit - l.credit), 0) into v_alfalah
    from journal_lines l join journal_entries e on e.id = l.entry_id
   where e.entry_number = 'TXN-26-000026' and l.account_code = '1010';

  select coalesce(sum(l.debit - l.credit), 0) into v_hbl
    from journal_lines l join journal_entries e on e.id = l.entry_id
   where e.entry_number = 'TXN-26-000029' and l.account_code = '1010';

  select coalesce(sum(l.debit - l.credit), 0) into v_cba
    from journal_lines l join journal_entries e on e.id = l.entry_id
   where e.entry_number = 'TXN-26-000027' and l.account_code = '9999';

  select coalesce(sum(l.debit - l.credit), 0) into v_cash
    from journal_lines l join journal_entries e on e.id = l.entry_id
   where e.entry_number = 'TXN-26-000007' and l.account_code = '1010';

  v_from1010 := v_alfalah + v_hbl + v_cash;

  if v_from1010 = 0 and v_cba = 0 then
    return;  -- yahan wo qatarein hain hi nahi (jaise Testing par)
  end if;

  insert into journal_entry_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = journal_entry_counters.last_number + 1
  returning last_number into v_next;

  v_num := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

  insert into journal_entries (entry_number, entry_date, description, source_module, created_by)
  values (v_num, current_date,
          'Khaton ki durustagi — har bank ka apna khata (328)',
          'finance', null)
  returning id into v_entry;

  if v_alfalah <> 0 then
    insert into journal_lines (entry_id, account_code, debit, credit, memo)
    values (v_entry, '1011', v_alfalah, 0, 'Bank Alfalah ka shuruati balance — 1010 se apne khate par');
  end if;

  if v_hbl <> 0 then
    insert into journal_lines (entry_id, account_code, debit, credit, memo)
    values (v_entry, '1012', v_hbl, 0, 'HBL ka shuruati balance — 1010 se apne khate par');
  end if;

  if v_cba <> 0 then
    insert into journal_lines (entry_id, account_code, debit, credit, memo)
    values
      (v_entry, '1014', v_cba, 0, 'CBA Account ka shuruati balance — Suspense se apne khate par'),
      (v_entry, '9999', 0, v_cba, 'Suspense se nikala — GL khata darj ho gaya');
  end if;

  if v_cash <> 0 then
    insert into journal_lines (entry_id, account_code, debit, credit, memo)
    values (v_entry, '1000', v_cash, 0, 'MB-2026-00006 ka advance — bank par likha gaya tha, cash tha');
  end if;

  if v_from1010 <> 0 then
    insert into journal_lines (entry_id, account_code, debit, credit, memo)
    values (v_entry, '1010', 0, v_from1010, 'Doosre khaton par bheji gayi raqam');
  end if;

  raise notice 'Durustagi ki entry ban gayi: % (1010 se %, Suspense se %)', v_num, v_from1010, v_cba;
end $$;


-- ---------------------------------------------------------------------
-- 4) Al Rana Traders ka Rs 2,030 -- ledger mein laana
-- ---------------------------------------------------------------------
-- Ye raqam finance_accounts ke khane mein to thi, magar ledger mein us
-- ki koi qatar NAHI thi. Wo purane build ka nishan hai, jab shuruati
-- balance sirf khane mein likh diya jata tha.
--
-- Aisa balance sab se khatarnak qism ka hota hai: safha use dikhata hai,
-- is liye koi shak nahi karta -- magar Trial Balance, Money Trail aur
-- bank reconcile use jaante hi nahi. Do adad ban jate hain aur dono apni
-- jagah "theek" lagte hain.
--
-- Ye upar wali durustagi se ALAG entry hai, jaan boojh kar: wahan ek
-- ghalti theek hui, yahan ek raqam pehli dafa ledger mein aa rahi hai.
-- Do alag waqiat ek entry mein daalne se dono ki wajah gum ho jati.
do $$
declare
  v_acc   record;
  v_entry uuid;
  v_year  int := extract(year from now())::int % 100;
  v_next  int;
  v_num   text;
begin
  select id, name, coalesce(opening_balance, 0) as bal
    into v_acc
    from finance_accounts
   where name = 'Al Rana Traders (kisan dukan)' and gl_code = '1013'
   limit 1;

  if not found or v_acc.bal <= 0 then
    return;
  end if;

  if exists (select 1 from journal_lines where account_code = '1013') then
    return;
  end if;

  insert into journal_entry_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = journal_entry_counters.last_number + 1
  returning last_number into v_next;

  v_num := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

  insert into journal_entries (entry_number, entry_date, description, source_module, created_by)
  values (v_num, current_date,
          'Shuruati balance — ' || v_acc.name || ' (ledger mein nahi tha)',
          'finance', null)
  returning id into v_entry;

  insert into journal_lines (entry_id, account_code, debit, credit, memo)
  values
    (v_entry, '1013', v_acc.bal, 0, 'Shuruati balance — ' || v_acc.name),
    (v_entry, '3200', 0, v_acc.bal, 'Shuruati balance — ' || v_acc.name);

  raise notice 'Al Rana ka shuruati balance ledger mein aa gaya: % (%)', v_acc.bal, v_num;
end $$;


-- ---------------------------------------------------------------------
-- 5) Rs 19,000 ka advance -- cash book mein bhi
-- ---------------------------------------------------------------------
-- Upar (hissa 3) us ki raqam bank se cash par le aayi gayi. Magar us ka
-- CASH BOOK wala indraj kabhi bana hi nahi tha -- yani golak ka adad
-- Rs 19,000 kam bata raha tha.
--
-- Sirf ledger theek karna aadha kaam hota: kitab kehti Rs 34,000 aur
-- cash book kehta Rs 15,000, aur raat ki ginti par har roz ek aisa farq
-- nikalta jis ki koi wajah na hoti.
do $$
declare
  v_cash uuid;
begin
  select id into v_cash from finance_accounts where name = 'Cash in Hand' limit 1;
  if v_cash is null then return; end if;

  -- Sirf tab, jab upar wali durustagi waqai lagi ho.
  if not exists (
    select 1 from journal_lines l join journal_entries e on e.id = l.entry_id
     where e.description like 'Khaton ki durustagi — har bank ka apna khata%'
       and l.account_code = '1000'
  ) then
    return;
  end if;

  if exists (
    select 1 from finance_transactions
     where account_id = v_cash and notes like 'Machinery booking MB-2026-00006%'
  ) then
    return;
  end if;

  insert into finance_transactions
    (account_id, transaction_type, category, amount, transaction_date, notes, created_by)
  values
    (v_cash, 'income', 'Machinery - Advance', 19000, date '2026-09-04',
     'Machinery booking MB-2026-00006 — advance (cash book mein reh gaya tha, 328 mein darj hua)', null);

  raise notice 'Rs 19,000 ka advance cash book mein darj ho gaya.';
end $$;
