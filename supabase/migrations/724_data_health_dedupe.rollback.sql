-- Rollback 724: dedupe wapas roz-ki-key par, superseded qatarein khul jati hain.
-- Stock, batch, ledger, journal — koi raqam nahi badalti.
-- Jo insaan ne khud resolved kiya (resolved_by bhara hua) wo nahi khulta.

drop index if exists public.uq_data_health_findings_open_fingerprint;

update public.data_health_findings
   set status = 'open',
       resolution_note = null,
       resolved_at = null,
       resolved_by = null
 where status = 'resolved'
   and resolution_note = 'superseded_by_duplicate'
   and resolved_by is null;

create or replace function public.fn_data_health_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Ye masla mitaya nahi ja sakta — dekh kar band kiya ja sakta hai.';
  end if;
  if old.status <> 'open' and new.status = old.status
     and new.resolution_note is not distinct from old.resolution_note then
    return new;
  end if;
  if new.status <> 'open' and (new.resolution_note is null or length(btrim(new.resolution_note)) < 5 or new.resolved_by is null) then
    raise exception 'Band karne ki wajah likhna zaroori hai (kam az kam 5 harf).';
  end if;
  if new.dedupe_key is distinct from old.dedupe_key
     or new.amount is distinct from old.amount
     or new.finding_type is distinct from old.finding_type then
    raise exception 'Saboot badla nahi ja sakta — sirf faisla likha ja sakta hai.';
  end if;
  return new;
end;
$$;

-- 514 jaisa scan: on conflict do nothing, tareekh wali keys.
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

drop function if exists public.fn_data_health_record(text, text, text, text, text, text, uuid, text, numeric, text);
drop function if exists public.fn_data_health_supersede_open_duplicates();
drop function if exists public.fn_data_health_fingerprint(text);

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'system.data_health', 'rm',
  'Poore business ki roz khud-kaar jaanch -- dobara payment, gum shuda stock qatar, ledger ka farq waghera khud dhoondh kar batata hai. Koi bhi cheez khud theek nahi hoti, sirf DHOONDH kar batata hai.',
  'Har department apna hissa dekh sakta hai (Finance, Machinery, Inventory, HR waghera). Faisla (Claude ko bhejna / theek ho gaya / chhoड़ dena) sirf Admin, Owner, ya Super Admin kar sakte hain.',
  'Roz subah check karein, ya jab bhi kisi hisaab mein shak ho ke kuch farq hai.',
  array[
    '"Abhi dekhein" dabayein -- naye masle turant dhoondh kar dikha dega.',
    'Har masle ka department, tafseel aur (agar hai to) raqam dikhti hai.',
    'Teen faisle: "Claude ko bhej do check karne" (agli Claude Code session mein utha kar theek karwayein), "Theek ho gaya" (khud fix kar chuke hain), ya "Theek hai, chhoड़ do" (jaan boojh kar aisa hai, masla nahi).',
    'Har faisle ke sath wajah likhna zaroori hai -- "dekh liya" likh dena aur kuch na dekhna, dono ek jaise nazar aate hain.'
  ],
  'Jo masle "Claude ko bhej do" mark hue hon, unhein agli Claude Code session ki shuruaat mein khud bata dein -- ye khud kisi ko notify nahi karta.',
  array[
    'Ye safha khud kuch theek nahi karta -- agar koi soche ke "dikha diya matlab theek ho gaya", to asal ghalati waisi hi reh jati hai.',
    'Bina wajah likhe "chhoड़ do" dabana -- agli baar koi nahi bata sakega ke ye jaan boojh kar chhoड़a tha ya bhool gaye.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;
