-- =====================================================================
-- 658: doodh ki adaigi — qist, GL aur khata ka taala ek transaction
-- =====================================================================
-- Qist pehle TypeScript mein kat-ti thi, adaigi baad mein. Beech mein
-- tootne par qist reh jati thi aur wapsi ki ghalti chup jati thi.
-- Ab qist, adaigi, khata, wallet aur GL ek hi function mein hain.
-- Naqad ki GL: debit 1150 (kisan ka khata, jo FAT ne credit kiya),
-- credit 1000 (cash bahar gaya).

-- Service role server ki chaabi hai. Logged-in user seedha reverse
-- nahi chala sakta (N7).
do $q$
begin
  if to_regprocedure('public.fn_qist_reverse_source(text, uuid, text)') is not null then
    execute 'revoke all on function public.fn_qist_reverse_source(text, uuid, text) from public, anon, authenticated';
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute 'grant execute on function public.fn_qist_reverse_source(text, uuid, text) to service_role';
    end if;
  end if;
end
$q$;

-- Service client se qist tabhi jab server ne payment function bulayi ho.
-- Insan ka login ab bhi purane roles se maker rehta hai.
do $m$
begin
  if to_regprocedure('auth.role()') is not null
     or to_regprocedure('public.fn_payroll_my_role()') is not null then
    execute $fn$
      create or replace function public.fn_qist_is_maker()
      returns boolean
      language sql
      stable
      security definer
      set search_path = public, auth, pg_temp
      as $body$
        select coalesce(auth.role(), '') = 'service_role'
          or coalesce(public.fn_payroll_my_role() in ('hr','finance','manager','admin','owner','super_admin'), false)
      $body$
    $fn$;
  end if;
end
$m$;

-- Do FAT ek sath: balance_after ka sum() bina taale ke galat ho jata tha.
create or replace function public.fn_apply_farmer_credit_entry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_current numeric;
begin
  perform pg_advisory_xact_lock(hashtext('farmer-credit:' || new.farmer_id::text));
  select coalesce(sum(case when ledger_type = 'debit' then amount else -amount end), 0)
    into v_current
  from public.farmer_credit_ledger
  where farmer_id = new.farmer_id;
  new.balance_after := v_current + (case when new.ledger_type = 'debit' then new.amount else -new.amount end);
  return new;
end $$;

drop function if exists public.fn_record_milk_payment(uuid, numeric, numeric, text, text, uuid, uuid);

create or replace function public.fn_record_milk_payment(
  p_farmer uuid,
  p_amount numeric,
  p_method text,
  p_notes text,
  p_by uuid,
  p_client uuid,
  p_skip_qist boolean default false,
  p_branch uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_cash numeric;
  v_qist numeric := 0;
  v_bal numeric;
  v_id uuid;
  v_wallet_id uuid;
  v_label text;
  v_applied jsonb;
  v_qist_already boolean := false;
  v_item jsonb;
  v_origin text;
  v_recv text;
  v_take numeric;
  v_qj jsonb;
  v_journal uuid;
  v_plan uuid;
  v_memo text;
begin
  if p_farmer is null then
    raise exception 'Farmer batana zaroori hai.';
  end if;
  if p_client is null then
    raise exception 'Adaigi ka nishan (client_action_id) zaroori hai.';
  end if;
  if v_amount <= 0 then
    raise exception 'Amount zero se zyada honi chahiye.';
  end if;

  perform pg_advisory_xact_lock(hashtext('milk-pay:' || p_farmer::text));

  if exists (select 1 from public.milk_payments where client_action_id = p_client) then
    return jsonb_build_object('already', true);
  end if;

  if coalesce(p_skip_qist, false) and (p_notes is null or length(btrim(p_notes)) < 3) then
    raise exception 'Qist is dafa na kaatne ki wajah likhein.';
  end if;

  if not coalesce(p_skip_qist, false) then
    v_applied := public.fn_qist_apply(
      'farmer', p_farmer, 'milk', (now() at time zone 'Asia/Karachi')::date,
      v_amount, 'milk_payment_qist', p_client
    );
    v_qist := round(coalesce((v_applied->>'deduct')::numeric, 0), 2);
    v_qist_already := coalesce((v_applied->>'already')::boolean, false);
  end if;

  v_cash := round(v_amount - v_qist, 2);
  if v_cash < -0.009 then
    raise exception 'Qist adaigi se bari hai.';
  end if;
  if v_cash < 0 then
    v_cash := 0;
  end if;

  v_bal := public.fn_milk_payable_balance(p_farmer);
  if round(v_cash + v_qist, 2) > round(coalesce(v_bal, 0), 2) + 0.009 then
    raise exception 'Adaigi baqaya se zyada hai. Baqaya Rs %, adaigi Rs %.', round(coalesce(v_bal, 0), 2), round(v_cash + v_qist, 2);
  end if;

  if v_qist > 0 then
    insert into public.milk_payments (farmer_id, amount, payment_method, notes, created_by, client_action_id)
    values (
      p_farmer,
      v_qist,
      'qist_adjustment',
      format('Qist Plan kattauti (naqad nahi diya) Rs %s', v_qist),
      p_by,
      case when v_cash <= 0 then p_client else null end
    );

    if not v_qist_already then
      for v_item in select value from jsonb_array_elements(coalesce(v_applied->'items', '[]'::jsonb)) loop
        v_take := round(coalesce((v_item->>'deduct')::numeric, 0), 2);
        continue when v_take <= 0;
        v_plan := (v_item->>'plan_id')::uuid;
        select s.origin into v_origin from public.qist_plans s where s.id = v_plan;
        if v_origin is null then
          raise exception 'Qist plan nahi mila.';
        end if;
        v_recv := case when v_origin = 'advance' then '1140' else '1150' end;
        v_memo := format('Qist %s -- doodh ki adaigi se kati', coalesce(v_item->>'code', ''));
        v_qj := public.post_journal_atomic(jsonb_build_object(
          'description', v_memo,
          'sourceModule', 'qist',
          'sourceId', p_farmer,
          'branchId', p_branch,
          'entryDate', (now() at time zone 'Asia/Karachi')::date,
          'createdBy', p_by,
          'lines', jsonb_build_array(
            jsonb_build_object('account', '2010', 'debit', v_take, 'partyType', 'farmer', 'partyId', p_farmer, 'memo', v_memo),
            jsonb_build_object('account', v_recv, 'credit', v_take, 'partyType', 'farmer', 'partyId', p_farmer, 'memo', v_memo)
          ),
          'claims', jsonb_build_array(jsonb_build_object('table', 'milk_payment_qist:' || v_plan::text, 'rowId', p_client))
        ));
        if v_journal is null then
          v_journal := (v_qj->>'id')::uuid;
        end if;
      end loop;
      if v_journal is not null then
        perform public.fn_qist_set_deduction_journal('milk_payment_qist', p_client, v_journal);
      end if;
      insert into public.farmer_credit_ledger (
        farmer_id, source_type, ledger_type, amount, balance_after, reference_id, notes, created_by
      ) values (
        p_farmer, 'milk', 'debit', v_qist, 0, p_client, format('Adaigi se qist kati (Rs %s)', v_qist), p_by
      );
      insert into public.farmer_credit_ledger (
        farmer_id, source_type, ledger_type, amount, balance_after, reference_id, notes, created_by
      ) values (
        p_farmer, 'produce_repayment', 'credit', v_qist, 0, p_client, 'Qist wasool -- doodh ki adaigi', p_by
      );
    end if;
  end if;

  if v_cash > 0 then
    v_label := format('Cash payment (%s)%s', coalesce(nullif(p_method, ''), 'cash'), case when p_notes is null or btrim(p_notes) = '' then '' else ' - ' || p_notes end);
    insert into public.milk_payments (farmer_id, amount, payment_method, notes, created_by, client_action_id)
    values (p_farmer, v_cash, p_method, nullif(btrim(coalesce(p_notes, '')), ''), p_by, p_client)
    returning id into v_id;

    insert into public.farmer_credit_ledger (
      farmer_id, source_type, ledger_type, amount, balance_after, reference_id, notes, created_by
    ) values (
      p_farmer, 'milk', 'debit', v_cash, 0, v_id, v_label, p_by
    );

    select w.id into v_wallet_id
    from public.wallets w
    where w.owner_type = 'farmer' and w.owner_id = p_farmer
    for update;
    if v_wallet_id is not null then
      insert into public.wallet_transactions (
        wallet_id, type, direction, amount, balance_after, reference_type, reference_id, notes, created_by
      ) values (
        v_wallet_id, 'milk_payment', 'debit', v_cash, 0, 'milk_payment', v_id, v_label, p_by
      );
    end if;

    perform public.post_journal_atomic(jsonb_build_object(
      'description', v_label,
      'sourceModule', 'farmer_credit',
      'sourceId', p_farmer,
      'branchId', p_branch,
      'entryDate', (now() at time zone 'Asia/Karachi')::date,
      'createdBy', p_by,
      'lines', jsonb_build_array(
        jsonb_build_object('account', '1150', 'debit', v_cash, 'partyType', 'farmer', 'partyId', p_farmer, 'memo', v_label),
        jsonb_build_object('account', '1000', 'credit', v_cash, 'memo', v_label)
      ),
      'claims', jsonb_build_array(jsonb_build_object('table', 'milk_payments', 'rowId', v_id))
    ));
  end if;

  return jsonb_build_object('already', false, 'id', v_id, 'cash', v_cash, 'qist', v_qist);
end $$;

revoke all on function public.fn_record_milk_payment(uuid, numeric, text, text, uuid, uuid, boolean, uuid) from public, anon, authenticated;

do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_record_milk_payment(uuid, numeric, text, text, uuid, uuid, boolean, uuid) to service_role;
  end if;
end
$g$;

comment on function public.fn_record_milk_payment(uuid, numeric, text, text, uuid, uuid, boolean, uuid) is
  'Doodh ki adaigi: qist, khata, wallet aur cash GL (1150/1000) ek transaction (658).';
