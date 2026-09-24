-- =====================================================================
-- AgriBridge — Migration 429: Shift band hone par cash "custody" mein
-- =====================================================================
-- Malik (16 September, Anwar ka screenshot): "aap ke paas zero hai
-- magar cash 1,070 bheja ja raha hai, ye kya hai?"
--
-- Root cause: POS Shift Close (`closeShift`) sirf `pos_shifts` ka
-- record likhta tha -- ledger mein KABHI kuch nahi jata tha. `Cash
-- Bhejein` (sendCash, `from_source=my_custody`) is hisaab se poochta
-- hai ke "is bande ke 1030 (cashWithPerson) mein itni raqam hai?" --
-- aur jawab hamesha "nahi" aata, kyunke wo raqam wahan kabhi daali hi
-- nahi gayi thi. Shift ka `counted_cash` sach bol raha tha, ledger
-- jhoot -- aur "Aap ke paas Rs 0" ledger ka jawab tha.
--
-- Code side (`src/actions/pos-counters.ts`, isi commit mein) ab shift
-- band hote hi ye reclassify karta hai: POS sale ke waqt hi ACC.cash
-- (1000) mein raqam ja chuki hoti hai (koi naya paisa nahi) -- shift
-- close par usay "company ke aam khate" se "isi staff ke haath mein"
-- (1030) le jaya jata hai. `Cash Bhejein`/`receiveCash` isay aage
-- sender->receiver->wapas 1000 tak le jate hain -- poora chakkar khud
-- ko barabar rakhta hai.
--
-- Ye migration sirf un shifts ko theek karta hai jo is fix se PEHLE
-- band ho chuki thin aur abhi tak "cash bhejna baqi" hain (Anwar ka
-- SHIFT-26-00001 samet) -- taake unhein rebuild ka intezar na karna
-- pare.
do $$
declare
  r record;
  v_year int;
  v_next int;
  v_entry_number text;
  v_entry_id uuid;
begin
  for r in
    select s.id as shift_id, s.shift_number, s.staff_id, s.counted_cash, c.branch_id
      from pos_shifts s
      join pos_counters c on c.id = s.counter_id
     where s.status = 'closed'
       and s.cash_handover_id is null
       and s.counted_cash > 0
  loop
    v_year := extract(year from now())::int % 100;

    insert into journal_entry_counters (year, last_number)
    values (v_year, 1)
    on conflict (year) do update set last_number = journal_entry_counters.last_number + 1
    returning last_number into v_next;

    v_entry_number := 'TXN-' || v_year || '-' || lpad(v_next::text, 6, '0');

    insert into journal_entries (entry_number, entry_date, description, source_module, source_id, branch_id, is_backdated, created_by)
    values (
      v_entry_number,
      current_date,
      'Shift ' || r.shift_number || ' band — ginti hui cash custody mein (429 backfill)',
      'pos_shift_close',
      r.shift_id,
      r.branch_id,
      false,
      r.staff_id
    )
    returning id into v_entry_id;

    insert into journal_lines (entry_id, account_code, debit, credit, party_type, party_id, memo, line_order) values
      (v_entry_id, '1030', r.counted_cash, 0, 'staff', r.staff_id, 'Shift ' || r.shift_number, 1),
      (v_entry_id, '1000', 0, r.counted_cash, null, null, 'Shift ' || r.shift_number || ' — golak se staff ke haath mein', 2);
  end loop;
end $$;
