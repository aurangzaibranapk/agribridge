-- =====================================================================
-- AgriBridge — Migration 336: Machinery vendor ka apna khata
-- =====================================================================
-- Malik (6 September), Chart of Accounts par Rs 104,796 dekh kar:
--
--   *"ye supplier to na hua na, ye to vendor mein aayega -- machinery
--   vendor mein."*
--
-- Wo bilkul theek keh rahe the.
--
-- =====================================================================
-- JO MASLA THA
-- =====================================================================
--
-- Khata **2000 "Supplier ko dena"** par Rs 104,796 khaRe the. Us mein se
-- **poore ke poore** machinery vendor (Farman Ali) ke the -- maal wale
-- supplier ka ek rupya bhi nahi. Chhe machinery bill, aur un mein se ek
-- adaigi (Rs 32,000, jab kisan ne seedha vendor ko diya tha).
--
-- **Adad theek tha, jagah ghalat thi.** Aur us ka nateeja ye tha ke
-- safha "Supplier ko dena — Rs 104,796" likhta tha, aur malik ko lagta
-- tha kisi maal wale ka itna dena hai.
--
-- =====================================================================
-- YE SIRF NAAM KI BAAT NAHI
-- =====================================================================
--
-- Dono ka peechha karne ka tareeqa alag hai:
--
--   * **Supplier** ko bill ke against ada karte hain -- maal aaya, bill
--     aaya, paisa gaya.
--   * **Machinery vendor** ka hissa kaam poora hone par banta hai, aur
--     us mein se pehle hamara commission (12%) nikalta hai.
--
-- Ek khate mein rakhne se koi bhi report ye nahi bata sakti thi ke maal
-- walon ka waqai kitna dena hai. Aaj wo sawal khud malik ne poochha, aur
-- jawab ke liye ledger ki qatarein haath se ginni paRin -- yehi is baat
-- ka saboot hai ke khata alag hona chahiye tha.
--
-- =====================================================================
-- PURANI QATAREIN BADLI NAHI JATIN
-- =====================================================================
--
-- Wohi usool jo 328 aur 330 mein: post ho chuki entry par database khud
-- taala laga deta hai (`fn_no_journal_update`), aur wo taala theek hai.
-- Is liye yahan bhi ek DURUSTAGI ki entry banti hai, purani qatarein
-- apni jagah rehti hain, aur dono nazar aati hain.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Naya khata
-- ---------------------------------------------------------------------
-- 2005 jaan boojh kar chuna: 2000 (supplier) aur 2010 (kisan) ke
-- darmiyan, taake fehrist mein wo apni tarah ke khaton ke sath hi baithe.
insert into public.gl_accounts (code, name, account_type, normal_side, sort_order)
values ('2005', 'Machinery vendor ko dena', 'liability', 'credit', 2005)
on conflict (code) do update set name = excluded.name;


-- ---------------------------------------------------------------------
-- 2) Jo raqam machinery vendor ki hai, wo naye khate par
-- ---------------------------------------------------------------------
-- Raqam HAATH SE nahi likhi ja rahi. Ye 2000 par un qataron se gini
-- jati hai jin par `party_type = 'machinery_vendor'` hai -- yani jo
-- waqai vendor ki hain. Agar kal koi asal supplier ki qatar bhi 2000 par
-- aa gayi ho to wo apni jagah rahegi.
--
-- Har vendor ki apni qatar banti hai (party_id ke sath), taake naye
-- khate par bhi ye maloom rahe ke kis ka kitna dena hai.
do $$
declare
  v_entry uuid;
  v_year  int := extract(year from now())::int % 100;
  v_next  int;
  v_num   text;
  r       record;
  v_kul   numeric := 0;
begin
  -- Ek dafa se zyada na chale.
  if exists (select 1 from journal_entries
              where description like 'Machinery vendor ka dena apne khate par (336)%') then
    raise notice '336 pehle chal chuki hai.';
    return;
  end if;

  select coalesce(sum(coalesce(l.credit,0) - coalesce(l.debit,0)), 0)
    into v_kul
    from journal_lines l
   where l.account_code = '2000' and l.party_type = 'machinery_vendor';

  if v_kul = 0 then
    raise notice 'Machinery vendor ka koi dena 2000 par nahi -- kuch karne ki zarurat nahi.';
    return;
  end if;

  insert into journal_entry_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = journal_entry_counters.last_number + 1
  returning last_number into v_next;

  v_num := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

  insert into journal_entries (entry_number, entry_date, description, source_module, created_by)
  values (v_num, current_date,
    'Machinery vendor ka dena apne khate par (336) — 2000 se 2005',
    'finance', null)
  returning id into v_entry;

  -- Har vendor alag qatar. 2000 par debit (dena kam), 2005 par credit
  -- (dena wahan aa gaya). Kul raqam wahi rehti hai -- sirf khata badla.
  for r in
    select l.party_id,
           round(sum(coalesce(l.credit,0) - coalesce(l.debit,0)), 2) as dena
      from journal_lines l
     where l.account_code = '2000' and l.party_type = 'machinery_vendor'
     group by l.party_id
    having round(sum(coalesce(l.credit,0) - coalesce(l.debit,0)), 2) <> 0
  loop
    insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id, memo)
    values (v_entry, '2000', r.dena, 0, 'machinery_vendor', r.party_id,
            'Machinery vendor ka dena — supplier ke khate se nikala');

    insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id, memo)
    values (v_entry, '2005', 0, r.dena, 'machinery_vendor', r.party_id,
            'Machinery vendor ka dena — apne khate par');
  end loop;

  raise notice 'Rs % 2000 se 2005 par (entry %)', v_kul, v_num;
end $$;


comment on table public.gl_accounts is
  'Khaton ka naqsha. 2000 sirf MAAL wale supplier ka dena; machinery vendor ka apna 2005 hai (336) -- dono ka peechha karne ka tareeqa alag hai.';
