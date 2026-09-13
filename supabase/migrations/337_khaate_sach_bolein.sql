-- =====================================================================
-- AgriBridge — Migration 337: Khaate sach bolein
-- =====================================================================
-- Malik ne 6 September ko Chart of Accounts khud parha aur teen sawal
-- kiye. Teenon mein adad theek tha, magar khata ya naam jhoot bol raha
-- tha. 336 ne pehla theek kiya (machinery vendor ka apna khata); ye
-- baqi do karti hai.
--
-- =====================================================================
-- 1) "Pichhla nafa" Rs 36,436 -- ye nafa hai hi nahi
-- =====================================================================
--
-- Malik: *"ye nafa kahan hai? Hum ne kaam kal start kia, ye nafa kahan
-- se aa gaya hai?"*
--
-- Wo bilkul theek the. Wo raqam shuruati balance ka DOOSRA SIRA hai:
--
--     Bank Alfalah   7,165
--     CBA              521
--     UBL           11,370
--     HBL              350
--     Cash in Hand  15,000
--     Al Rana Traders 2,030
--     -------------------
--                   36,436
--
-- Jab har khate ka shuruati balance darj hua, to double-entry ke liye
-- doosra sira chahiye tha, aur wo 3200 (Pichhla nafa) par chala gaya.
--
-- **Magar ye paisa karobar ne KAMAYA nahi -- malik ne DAALA hai.** Us ki
-- jagah 3000 (Malik ka sarmaya) hai.
--
-- Farq mamooli nahi: jab tak ye 3200 par hai, har nafa-nuqsan ki report
-- ye dawa karti hai ke karobar pehle hi Rs 36,436 kama chuka hai. Pehle
-- hi mahine ki report jhooti hoti.
--
-- =====================================================================
-- 2) "Machinery kiraya" -- poora kiraya hamara nahi
-- =====================================================================
--
-- Khata 4030 par Rs 18,654 hain, aur wo THEEK hain -- magar naam se
-- lagta hai ke machinery ka poora kiraya hamari aamdani hai. Aisa nahi:
-- kaam ka paisa vendor ka hai, us mein se sirf hamara **commission**
-- (12%) is khate par aata hai. Baqi vendor ka hissa 2005 par jata hai
-- (336 se).
--
-- Sirf naam badla ja raha hai. Ek bhi qatar nahi chhuyi ja rahi.
--
-- =====================================================================
-- PURANI QATAREIN BADLI NAHI JATIN
-- =====================================================================
-- Wohi usool jo 328, 330 aur 336 mein: post ho chuki entry par database
-- khud taala laga deta hai, aur wo taala theek hai. Durustagi hamesha
-- NAYI entry se hoti hai, taake dono nazar aayein.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Shuruati balance ka doosra sira -- nafe se sarmaye par
-- ---------------------------------------------------------------------
do $$
declare
  v_entry uuid;
  v_year  int := extract(year from now())::int % 100;
  v_next  int;
  v_num   text;
  v_raqam numeric := 0;
begin
  if exists (select 1 from journal_entries
              where description like 'Shuruati balance nafe se sarmaye par (337)%') then
    raise notice '337 pehle chal chuki hai.';
    return;
  end if;

  -- Raqam HAATH SE nahi likhi ja rahi -- sirf wo qatarein gini ja rahi
  -- hain jo shuruati balance se 3200 par aayi thin.
  select coalesce(sum(coalesce(l.credit,0) - coalesce(l.debit,0)), 0)
    into v_raqam
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
   where l.account_code = '3200'
     and e.description like 'Shuruati balance%';

  if v_raqam = 0 then
    raise notice '3200 par shuruati balance ki koi qatar nahi.';
    return;
  end if;

  insert into journal_entry_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = journal_entry_counters.last_number + 1
  returning last_number into v_next;

  v_num := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

  insert into journal_entries (entry_number, entry_date, description, source_module, created_by)
  values (v_num, current_date,
    'Shuruati balance nafe se sarmaye par (337) — 3200 se 3000. Ye karobar ne kamaya nahi, malik ne daala hai.',
    'finance', null)
  returning id into v_entry;

  insert into journal_lines (entry_id, account_code, debit, credit, memo) values
    (v_entry, '3200', v_raqam, 0, 'Shuruati balance ka doosra sira — ye nafa nahi tha'),
    (v_entry, '3000', 0, v_raqam, 'Malik ka daala hua sarmaya (shuruati balance)');

  raise notice 'Rs % 3200 se 3000 par (entry %)', v_raqam, v_num;
end $$;


-- ---------------------------------------------------------------------
-- 2) 4030 ka naam -- kiraya nahi, hamara commission
-- ---------------------------------------------------------------------
update public.gl_accounts
   set name = 'Machinery ka commission (hamara hissa)'
 where code = '4030';
