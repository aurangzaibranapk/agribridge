-- =====================================================================
-- AgriBridge — Migration 358: Stock (1200) ka purana Rs 28 ka farq
-- =====================================================================
-- Master Dashboard par (7 September): "Godam ki ginti (trade rate par):
-- Rs 0 · Ledger ka khata 1200: Rs -28 · Farq: Rs 28."
--
-- Jaanch: `v_ledger_unposted` par is waqt koi `purchases` ya
-- `supplier_payments` unposted NAHI hai -- yani koi kharid ledger tak
-- pahunchne se reh nahi gayi. Farq ki asal jaRh 1200 ki poori tareekh
-- mein hai:
--
--   4 Sep   POS bikri              -19
--   4 Sep   POS bikri               -9
--   4 Sep   POS wapsi RET-2026-00001 +9
--   5 Sep   POS bikri               -9
--   -----------------------------------
--                                  -28
--
-- Ye chaar qatarein 333 (kharid ki ledger entry) se PEHLE ki hain --
-- us waqt jo maal becha gaya, us ki koi kharid isi system se guzri hi
-- nahi thi (shuru ke test/demo sales), is liye koi purchase record hi
-- nahi jo backfill ho sake. Stock ab (godam mein) Rs 0 hai; ledger
-- 1200 ko bhi Rs 0 par aana chahiye.
--
-- Malik ka faisla (7 September): Rs 28 ko 9999 (Suspense) mein daal
-- dein -- Bank Reconciliation jaisa hi tareeqa, jahan wajah maloom na
-- ho wo Suspense mein jata hai, "sifar" ban kar chhupta nahi.
-- =====================================================================

do $$
declare
  v_entry uuid;
  v_year  int := extract(year from now())::int % 100;
  v_next  int;
  v_num   text;
  -- Ye chaaron sirf Live par hain (7 September ki jaanch mein mile).
  -- Testing par ye ID mojood nahi honge -- is liye wahan ye migration
  -- khud khamoshi se kuch nahi karti, farzi Rs 28 nahi ghusaati.
  v_source_ids uuid[] := array[
    '99550fd9-df04-48bd-86e9-384192cda419',
    'ebe81e29-5f4e-4e21-afba-bce41306721c',
    '2070538c-b74a-4399-aeae-1d6ac770f218',
    '86aa63ea-e65f-412f-8dd5-d7323d966d1d'
  ];
begin
  if exists (
    select 1 from journal_entries
     where description like 'Durustagi: Stock (1200) ka purana farq — Suspense mein (358)%'
  ) then
    raise notice '358 pehle chal chuki hai.';
    return;
  end if;

  if (select count(*) from journal_entries where source_id = any(v_source_ids)) <> 4 then
    raise notice '358: Live wali chaaron purani POS qatarein is database par nahi milin -- kuch nahi kiya.';
    return;
  end if;

  insert into journal_entry_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update set last_number = journal_entry_counters.last_number + 1
  returning last_number into v_next;

  v_num := 'TXN-' || v_year::text || '-' || lpad(v_next::text, 6, '0');

  insert into journal_entries (entry_number, entry_date, description, source_module, source_id, created_by)
  values (
    v_num, current_date,
    'Durustagi: Stock (1200) ka purana farq — Suspense mein (358). 4 POS qatarein (4-5 Sep) jin ki kharid is system se kabhi guzri nahi — malik ki tasdeeq.',
    'finance', null, null
  )
  returning id into v_entry;

  insert into journal_lines (entry_id, account_code, debit, credit, memo)
  values
    (v_entry, '1200', 28, 0, 'Stock ka khata godam ki asal ginti (Rs 0) se milaya'),
    (v_entry, '9999', 0, 28, 'Wajah maloom nahi — 333 se pehle ki 4 POS qatarein, koi matching kharid nahi');

  raise notice '358: entry % — Rs 28, 1200 se 9999 (Suspense)', v_num;
end $$;
