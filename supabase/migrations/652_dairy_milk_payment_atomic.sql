-- =====================================================================
-- 652: Doodh ki adaigi — baqaya, ek transaction, do dafa na ho
-- =====================================================================
-- Baqaya sirf priced/verified doodh minus adaigi. Pending aur rejected
-- is hisaab mein nahi. client_action_id ek form ki do dafa submit ko
-- ek hi adaigi rakhta hai.

alter table public.milk_payments
  add column if not exists client_action_id uuid;

create unique index if not exists idx_milk_payments_client_action
  on public.milk_payments (client_action_id) where client_action_id is not null;

create or replace function public.fn_milk_payable_balance(p_farmer uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select sum(total_amount) from public.milk_entries
    where farmer_id = p_farmer and status in ('priced', 'verified')
  ), 0) - coalesce((
    select sum(amount) from public.milk_payments where farmer_id = p_farmer
  ), 0);
$$;

revoke all on function public.fn_milk_payable_balance(uuid) from public, anon, authenticated;

create or replace function public.fn_record_milk_payment(
  p_farmer uuid,
  p_cash numeric,
  p_qist numeric,
  p_method text,
  p_notes text,
  p_by uuid,
  p_client uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cash numeric := round(coalesce(p_cash, 0), 2);
  v_qist numeric := round(coalesce(p_qist, 0), 2);
  v_bal numeric;
  v_id uuid;
  v_wallet_id uuid;
  v_label text;
begin
  if p_farmer is null then
    raise exception 'Farmer batana zaroori hai.';
  end if;
  if p_client is null then
    raise exception 'Adaigi ka nishan (client_action_id) zaroori hai.';
  end if;
  if v_cash < 0 or v_qist < 0 then
    raise exception 'Raqam manfi nahi ho sakta.';
  end if;
  if v_cash + v_qist <= 0 then
    raise exception 'Amount zero se zyada honi chahiye.';
  end if;

  perform pg_advisory_xact_lock(hashtext('milk-pay:' || p_farmer::text));

  if exists (select 1 from public.milk_payments where client_action_id = p_client) then
    return jsonb_build_object('already', true);
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
  end if;

  return jsonb_build_object('already', false, 'id', v_id, 'cash', v_cash, 'qist', v_qist);
end $$;

revoke all on function public.fn_record_milk_payment(uuid, numeric, numeric, text, text, uuid, uuid) from public, anon, authenticated;

do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_milk_payable_balance(uuid) to service_role;
    grant execute on function public.fn_record_milk_payment(uuid, numeric, numeric, text, text, uuid, uuid) to service_role;
  end if;
end
$g$;

-- Safhe ka baqaya aur adaigi ka taala ek hi adad. Pending/rejected bahar.
create or replace view public.milk_farmer_balances as
select
  f.id as farmer_id,
  f.full_name,
  f.farmer_code,
  f.phone_number,
  coalesce(entries.total_supplied, 0) as total_supplied,
  coalesce(payments.total_paid, 0) as total_paid,
  coalesce(entries.total_supplied, 0) - coalesce(payments.total_paid, 0) as balance_due
from public.farmers f
left join (
  select farmer_id, sum(total_amount) as total_supplied
  from public.milk_entries
  where status in ('priced', 'verified')
  group by farmer_id
) entries on entries.farmer_id = f.id
left join (
  select farmer_id, sum(amount) as total_paid
  from public.milk_payments
  group by farmer_id
) payments on payments.farmer_id = f.id
where f.is_deleted = false;

comment on view public.milk_farmer_balances is
  'Sirf priced aur verified doodh, minus adaigi. Pending aur rejected shamil nahi (652).';
