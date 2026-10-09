-- 514: Watchdog mein batch-qty vs inventory-qty ki jaanch (stock_ledger_recon_20261009 ke baad).
-- fn_data_health_scan wohi hai jo 396 mein tha (live se milaya), sirf section 3b naya hai:
-- har product+godam par inventory ginti != batch remaining ho to 'batch_inventory_mismatch' finding.

create or replace function public.fn_data_health_scan()
returns table(inserted_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  -- 1) Machinery: vendor ne farmer se seedha collect kiya HO aur usi
  --    booking par company ne bhi alag se cash/bank payout diya ho --
  --    yehi wo ghalati thi jo MB-2026-00008 mein 32000 dobara nikal
  --    gaye.
  for r in
    select mb.id as booking_id, mb.booking_number, je.entry_number, jl.debit as amount
    from machinery_payments mp
    join machinery_bookings mb on mb.id = mp.booking_id
    join journal_entries je on je.source_module = 'machinery_vendor_payout' and je.source_id = mb.id
    join journal_lines jl on jl.entry_id = je.id and jl.account_code in ('1000', '1010', '1011', '1012', '1013', '1014')
    where mp.method = 'vendor_collected'
      and coalesce(je.is_reversal, false) = false
      and not exists (
        select 1 from journal_entries r2
        where r2.reversal_of = je.id
      )
  loop
    insert into data_health_findings (finding_type, department, severity, title, description, related_table, related_id, related_label, amount, dedupe_key)
    values (
      'machinery_double_payout', 'machinery', 'high',
      'Vendor ko dobara payout ho sakta hai',
      format('Booking %s mein farmer ne vendor ko seedha paisa diya tha, magar isi booking par cash/bank se bhi alag payout (%s) darj hai -- dobara adaigi ho sakti hai.', r.booking_number, r.entry_number),
      'machinery_bookings', r.booking_id, r.booking_number, r.amount,
      'machinery_double_payout:' || r.booking_id::text
    )
    on conflict (dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  -- 2) Machinery: booking table ka apna total us ki bill se mel nahi
  --    khata -- jaisa MB-2026-00005 mein rakba theek hua magar booking
  --    ki purani raqam reh gayi thi.
  for r in
    select mb.id as booking_id, mb.booking_number, mb.total_amount, (bl.gross_amount - bl.discount_amount) as bill_net
    from machinery_bookings mb
    join machinery_bills bl on bl.booking_id = mb.id and bl.cancelled_at is null
    where round(coalesce(mb.total_amount, 0)::numeric, 2) <> round((bl.gross_amount - bl.discount_amount)::numeric, 2)
  loop
    insert into data_health_findings (finding_type, department, severity, title, description, related_table, related_id, related_label, amount, dedupe_key)
    values (
      'machinery_booking_bill_mismatch', 'machinery', 'medium',
      'Booking ka total bill se mel nahi khata',
      format('Booking %s ka apna total Rs %s hai, magar us ki bill Rs %s dikhati hai.', r.booking_number, r.total_amount, round(r.bill_net, 2)),
      'machinery_bookings', r.booking_id, r.booking_number, r.bill_net - coalesce(r.total_amount, 0),
      'machinery_booking_bill_mismatch:' || r.booking_id::text
    )
    on conflict (dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  -- 3) Stock: godam ki ginti (batch ki asal qeemat par) aur ledger ka
  --    khata 1200/1210/1220 -- Rs5 se zyada farq.
  declare
    v_stock_ledger numeric;
    v_stock_batches numeric;
    v_diff numeric;
  begin
    select coalesce(sum(debit) - sum(credit), 0) into v_stock_ledger
    from journal_lines where account_code in ('1200', '1210', '1220');

    select coalesce(sum(remaining_quantity * unit_cost), 0) into v_stock_batches
    from stock_batches;

    v_diff := round(v_stock_batches - v_stock_ledger, 2);
    if abs(v_diff) > 5 then
      insert into data_health_findings (finding_type, department, severity, title, description, amount, dedupe_key)
      values (
        'stock_ledger_mismatch', 'inventory', 'high',
        'Godam ki ginti aur ledger ka khata barabar nahi',
        format('Godam ki ginti (batch qeemat par): Rs %s. Ledger ka khata 1200: Rs %s. Farq: Rs %s.', round(v_stock_batches, 2), round(v_stock_ledger, 2), v_diff),
        v_diff,
        'stock_ledger_mismatch:' || to_char(current_date, 'YYYY-MM-DD')
      )
      on conflict (dedupe_key) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end;

  -- 3b) Batch aur ginti ka farq: har product+godam par inventory.quantity_on_hand
  --     ka jorh = stock_batches.remaining_quantity ka jorh hona chahiye. (514)
  for r in
    select coalesce(i.product_id, b.product_id) as product_id,
           coalesce(i.warehouse_id, b.warehouse_id) as warehouse_id,
           coalesce(i.oh, 0) as oh, coalesce(b.rem, 0) as rem
      from (select product_id, warehouse_id, sum(quantity_on_hand) oh from inventory group by 1, 2) i
      full join (select product_id, warehouse_id, sum(remaining_quantity) rem from stock_batches group by 1, 2) b
        on b.product_id = i.product_id and b.warehouse_id is not distinct from i.warehouse_id
     where coalesce(i.oh, 0) <> coalesce(b.rem, 0)
  loop
    insert into data_health_findings (finding_type, department, severity, title, description, related_table, related_id, related_label, amount, dedupe_key)
    values (
      'batch_inventory_mismatch', 'inventory', 'high',
      'Batch aur ginti barabar nahi',
      format('%s (%s): ginti %s, batch mein %s -- farq %s.',
        (select name from products where id = r.product_id),
        coalesce((select name from warehouses where id = r.warehouse_id), 'godam nahi'),
        r.oh, r.rem, r.oh - r.rem),
      'products', r.product_id,
      (select name from products where id = r.product_id),
      r.oh - r.rem,
      'batch_inventory_mismatch:' || r.product_id::text || ':' || coalesce(r.warehouse_id::text, '-') || ':' || to_char(current_date, 'YYYY-MM-DD')
    )
    on conflict (dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  -- 4) Koi bhi cash/bank khata manfi ho gaya ho.
  for r in
    select g.code, g.name, round(sum(coalesce(jl.debit, 0) - coalesce(jl.credit, 0)), 2) as balance
    from journal_lines jl
    join gl_accounts g on g.code = jl.account_code
    where g.code in ('1000', '1010', '1011', '1012', '1013', '1014', '1018')
    group by g.code, g.name
    having sum(coalesce(jl.debit, 0) - coalesce(jl.credit, 0)) < -1
  loop
    insert into data_health_findings (finding_type, department, severity, title, description, amount, dedupe_key)
    values (
      'negative_cash_account', 'finance', 'high',
      format('%s ka balance manfi hai', r.name),
      format('%s (khata %s) ka balance Rs %s hai -- manfi.', r.name, r.code, r.balance),
      r.balance,
      'negative_cash_account:' || r.code || ':' || to_char(current_date, 'YYYY-MM-DD')
    )
    on conflict (dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  return query select v_count;
end;
$$;
