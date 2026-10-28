-- =====================================================================
-- 724: Data Health — ek masla, ek khuli qataar
-- =====================================================================
-- Roz 04:00 UTC cron `fn_data_health_scan()` chalata hai.
-- stock_ledger_mismatch, batch_inventory_mismatch, aur negative_cash_account
-- ki dedupe_key ke aakhir mein tareekh lagi thi (`:YYYY-MM-DD`).
-- Unique constraint sirf usi din ki doosri insert rokta tha. Agle din nayi
-- key, purani qataar `open` reh jati thi. ~18 din ki naqlein queue mein
-- jam ho gayi thin.
--
-- Ab fingerprint = dedupe_key bina aakhri tareekh ke.
-- Nayi scan purani KHULI naqal band karti hai (status resolved,
-- resolution_note = superseded_by_duplicate, resolved_by null — koi
-- insaan faisla nahi). Taazi qataar khuli rehti hai.
-- sent_to_assistant / sent_to_claude / dismissed / pehle se resolved
-- ko ye raasta nahi chhoorta.
-- Stock, batch, ledger, journal — koi raqam nahi badalti. Sirf findings.
--
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 724_data_health_dedupe.rollback.sql

create or replace function public.fn_data_health_fingerprint(p_key text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select regexp_replace(coalesce(p_key, ''), ':[0-9]{4}-[0-9]{2}-[0-9]{2}$', '');
$$;

comment on function public.fn_data_health_fingerprint(text) is
  'Dedupe key bina aakhri :YYYY-MM-DD. Ek masle ki roz ki naqlein isi par milti hain.';

-- Guard: insaan ka faisla pehle jaisa. Sirf scan ka supersede (GUC) khuli
-- qataar ko resolved kar sakta hai, resolved_by ke baghair, aur saboot
-- (type, amount, key, matn) na badle.
create or replace function public.fn_data_health_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Ye masla mitaya nahi ja sakta — dekh kar band kiya ja sakta hai.';
  end if;

  if coalesce(current_setting('agribridge.data_health_supersede', true), '') = 'on' then
    if old.status = 'open'
       and new.status = 'resolved'
       and btrim(coalesce(new.resolution_note, '')) = 'superseded_by_duplicate'
       and new.resolved_by is null
       and new.dedupe_key is not distinct from old.dedupe_key
       and new.amount is not distinct from old.amount
       and new.finding_type is not distinct from old.finding_type
       and new.title is not distinct from old.title
       and new.description is not distinct from old.description
       and new.department is not distinct from old.department
       and new.severity is not distinct from old.severity
       and new.related_table is not distinct from old.related_table
       and new.related_id is not distinct from old.related_id
       and new.related_label is not distinct from old.related_label
    then
      if new.resolved_at is null then
        new.resolved_at := now();
      end if;
      return new;
    end if;
    raise exception 'Duplicate band karne ka raasta sirf khuli purani naqal par hai.';
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

create or replace function public.fn_data_health_supersede_open_duplicates()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer := 0;
begin
  perform set_config('agribridge.data_health_supersede', 'on', true);
  with ranked as (
    select id,
           row_number() over (
             partition by public.fn_data_health_fingerprint(dedupe_key)
             order by detected_at desc, id desc
           ) as rn
    from public.data_health_findings
    where status = 'open'
  ),
  closed as (
    update public.data_health_findings d
       set status = 'resolved',
           resolution_note = 'superseded_by_duplicate',
           resolved_at = now(),
           resolved_by = null
     where d.id in (select id from ranked where rn > 1)
       and d.status = 'open'
    returning 1
  )
  select count(*)::integer into v_n from closed;
  perform set_config('agribridge.data_health_supersede', 'off', true);
  return v_n;
end;
$$;

comment on function public.fn_data_health_supersede_open_duplicates() is
  'Har fingerprint par sab se taazi open qataar rakho. Purani open naqal resolved, note superseded_by_duplicate. Ledger ya stock nahi chhoota.';

-- Nayi snapshot: isi din ki key pehle se ho to kuch na karo.
-- Warna us fingerprint ki khuli qatarein band karo, phir ye qataar kholo.
create or replace function public.fn_data_health_record(
  p_finding_type text,
  p_department text,
  p_severity text,
  p_title text,
  p_description text,
  p_related_table text,
  p_related_id uuid,
  p_related_label text,
  p_amount numeric,
  p_dedupe_key text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp text;
begin
  if p_dedupe_key is null or length(btrim(p_dedupe_key)) = 0 then
    raise exception 'dedupe_key khali nahi ho sakti.';
  end if;
  if exists (select 1 from public.data_health_findings where dedupe_key = p_dedupe_key) then
    return false;
  end if;

  v_fp := public.fn_data_health_fingerprint(p_dedupe_key);
  perform set_config('agribridge.data_health_supersede', 'on', true);
  update public.data_health_findings
     set status = 'resolved',
         resolution_note = 'superseded_by_duplicate',
         resolved_at = now(),
         resolved_by = null
   where status = 'open'
     and public.fn_data_health_fingerprint(dedupe_key) = v_fp;
  perform set_config('agribridge.data_health_supersede', 'off', true);

  begin
    insert into public.data_health_findings (
      finding_type, department, severity, title, description,
      related_table, related_id, related_label, amount, dedupe_key
    ) values (
      p_finding_type, p_department, p_severity, p_title, p_description,
      p_related_table, p_related_id, p_related_label, p_amount, p_dedupe_key
    );
  exception
    when unique_violation then
      return false;
  end;
  return true;
end;
$$;

comment on function public.fn_data_health_record(text, text, text, text, text, text, uuid, text, numeric, text) is
  'Ek finding likho. Wahi fingerprint pehle se open ho to purani qataar superseded_by_duplicate. Isi key par dobara insert nahi.';

-- 514 wala scan, inserts ab fn_data_health_record se. Aakhir mein
-- jo naqlein is daur mein na chhui gaein (masla aaj scan mein nahi aaya)
-- un ki purani open copies bhi band.
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
  --    booking par company ne bhi alag se cash/bank payout diya ho.
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
    if public.fn_data_health_record(
      'machinery_double_payout', 'machinery', 'high',
      'Vendor ko dobara payout ho sakta hai',
      format('Booking %s mein farmer ne vendor ko seedha paisa diya tha, magar isi booking par cash/bank se bhi alag payout (%s) darj hai -- dobara adaigi ho sakti hai.', r.booking_number, r.entry_number),
      'machinery_bookings', r.booking_id, r.booking_number, r.amount,
      'machinery_double_payout:' || r.booking_id::text
    ) then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 2) Machinery: booking table ka apna total us ki bill se mel nahi khata.
  for r in
    select mb.id as booking_id, mb.booking_number, mb.total_amount, (bl.gross_amount - bl.discount_amount) as bill_net
    from machinery_bookings mb
    join machinery_bills bl on bl.booking_id = mb.id and bl.cancelled_at is null
    where round(coalesce(mb.total_amount, 0)::numeric, 2) <> round((bl.gross_amount - bl.discount_amount)::numeric, 2)
  loop
    if public.fn_data_health_record(
      'machinery_booking_bill_mismatch', 'machinery', 'medium',
      'Booking ka total bill se mel nahi khata',
      format('Booking %s ka apna total Rs %s hai, magar us ki bill Rs %s dikhati hai.', r.booking_number, r.total_amount, round(r.bill_net, 2)),
      'machinery_bookings', r.booking_id, r.booking_number, r.bill_net - coalesce(r.total_amount, 0),
      'machinery_booking_bill_mismatch:' || r.booking_id::text
    ) then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 3) Stock ledger vs batch value. Key mein tareekh rehti hai taake
  --    resolved ke baad masla laut aaye to nayi qataar ban sake.
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
      if public.fn_data_health_record(
        'stock_ledger_mismatch', 'inventory', 'high',
        'Godam ki ginti aur ledger ka khata barabar nahi',
        format('Godam ki ginti (batch qeemat par): Rs %s. Ledger ka khata 1200: Rs %s. Farq: Rs %s.', round(v_stock_batches, 2), round(v_stock_ledger, 2), v_diff),
        null, null, null, v_diff,
        'stock_ledger_mismatch:' || to_char(current_date, 'YYYY-MM-DD')
      ) then
        v_count := v_count + 1;
      end if;
    end if;
  end;

  -- 3b) Batch aur ginti ka farq (514).
  for r in
    select coalesce(i.product_id, b.product_id) as product_id,
           coalesce(i.warehouse_id, b.warehouse_id) as warehouse_id,
           coalesce(i.oh, 0) as oh, coalesce(b.rem, 0) as rem
      from (select product_id, warehouse_id, sum(quantity_on_hand) oh from inventory group by 1, 2) i
      full join (select product_id, warehouse_id, sum(remaining_quantity) rem from stock_batches group by 1, 2) b
        on b.product_id = i.product_id and b.warehouse_id is not distinct from i.warehouse_id
     where coalesce(i.oh, 0) <> coalesce(b.rem, 0)
  loop
    if public.fn_data_health_record(
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
    ) then
      v_count := v_count + 1;
    end if;
  end loop;

  -- 4) Cash/bank khata manfi.
  for r in
    select g.code, g.name, round(sum(coalesce(jl.debit, 0) - coalesce(jl.credit, 0)), 2) as balance
    from journal_lines jl
    join gl_accounts g on g.code = jl.account_code
    where g.code in ('1000', '1010', '1011', '1012', '1013', '1014', '1018')
    group by g.code, g.name
    having sum(coalesce(jl.debit, 0) - coalesce(jl.credit, 0)) < -1
  loop
    if public.fn_data_health_record(
      'negative_cash_account', 'finance', 'high',
      format('%s ka balance manfi hai', r.name),
      format('%s (khata %s) ka balance Rs %s hai -- manfi.', r.name, r.code, r.balance),
      null, null, null, r.balance,
      'negative_cash_account:' || r.code || ':' || to_char(current_date, 'YYYY-MM-DD')
    ) then
      v_count := v_count + 1;
    end if;
  end loop;

  perform public.fn_data_health_supersede_open_duplicates();
  return query select v_count;
end;
$$;

revoke all on function public.fn_data_health_fingerprint(text) from public;
revoke all on function public.fn_data_health_supersede_open_duplicates() from public, anon, authenticated;
revoke all on function public.fn_data_health_record(text, text, text, text, text, text, uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.fn_data_health_supersede_open_duplicates() to service_role;
grant execute on function public.fn_data_health_record(text, text, text, text, text, text, uuid, text, numeric, text) to service_role;
revoke execute on function public.fn_data_health_scan() from public, anon;
grant execute on function public.fn_data_health_scan() to authenticated, service_role;

-- Maujooda khuli naqlein: har fingerprint par sab se nayi rakho.
do $$
declare
  v_closed integer;
  v_dup integer;
begin
  v_closed := public.fn_data_health_supersede_open_duplicates();
  raise notice 'data health open duplicates closed: %', v_closed;
  select count(*) into v_dup
  from (
    select public.fn_data_health_fingerprint(dedupe_key)
    from public.data_health_findings
    where status = 'open'
    group by 1
    having count(*) > 1
  ) d;
  if v_dup > 0 then
    raise exception 'Data health open duplicates ab bhi khuli hain: %', v_dup;
  end if;
end $$;

create unique index if not exists uq_data_health_findings_open_fingerprint
  on public.data_health_findings (public.fn_data_health_fingerprint(dedupe_key))
  where status = 'open';

comment on index public.uq_data_health_findings_open_fingerprint is
  'Ek fingerprint par ek se zyada open qataar nahi. Resolved / dismissed / sent is mein nahi aate.';

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'system.data_health', 'rm',
  'Poore business ki roz khud-kaar jaanch -- dobara payment, gum shuda stock qatar, ledger ka farq waghera khud dhoondh kar batata hai. Koi bhi cheez khud theek nahi hoti, sirf DHOONDH kar batata hai. Ek masle ki sirf taazi qataar khuli rehti hai.',
  'Har department apna hissa dekh sakta hai (Finance, Machinery, Inventory, HR waghera). Faisla (Claude ko bhejna / theek ho gaya / chhoड़ dena) sirf Admin, Owner, ya Super Admin kar sakte hain.',
  'Roz subah check karein, ya jab bhi kisi hisaab mein shak ho ke kuch farq hai.',
  array[
    '"Abhi dekhein" dabayein -- naye masle turant dhoondh kar dikha dega.',
    'Har masle ka department, tafseel aur (agar hai to) raqam dikhti hai.',
    'Teen faisle: "Claude ko bhej do check karne" (agli Claude Code session mein utha kar theek karwayein), "Theek ho gaya" (khud fix kar chuke hain), ya "Theek hai, chhoड़ do" (jaan boojh kar aisa hai, masla nahi).',
    'Har faisle ke sath wajah likhna zaroori hai -- "dekh liya" likh dena aur kuch na dekhna, dono ek jaise nazar aate hain.',
    'Roz ka scan usi masle ki purani khuli naqal band kar deta hai. Note superseded_by_duplicate hota hai. Sirf taazi qataar khuli rehti hai. Ye note stock ya ledger theek hone ka saboot nahi.'
  ],
  'Jo masle "Claude ko bhej do" mark hue hon, unhein agli Claude Code session ki shuruaat mein khud bata dein -- ye khud kisi ko notify nahi karta. superseded_by_duplicate wali qataar dubara faisle ki zaroorat nahi rakhti.',
  array[
    'Ye safha khud kuch theek nahi karta -- agar koi soche ke "dikha diya matlab theek ho gaya", to asal ghalati waisi hi reh jati hai.',
    'Bina wajah likhe "chhoड़ do" dabana -- agli baar koi nahi bata sakega ke ye jaan boojh kar chhoड़a tha ya bhool gaye.',
    'Note superseded_by_duplicate ko "theek ho gaya" parhna. Asal farq ab bhi khuli taazi qataar par hai. Stock ki ginti ya ledger ki raqam is note se nahi badli.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;
