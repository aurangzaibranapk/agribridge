-- =====================================================================
-- 651: FAT, khata, wallet aur GL ek hi transaction
-- =====================================================================
-- Do log ek sath FAT lagayen to doosra 0 qatarein badalta tha aur
-- phir bhi khata doosri dafa likh deta tha. Ab qatar FOR UPDATE se
-- lock hoti hai. Koi bhi qadam nakaam ho to sab wapas — entry
-- pending_fat hi rehti hai.
--
-- GL wahi posting hai jo pehle TypeScript karti thi: debit 5010
-- (doodh ki khareed), credit 1150 (kisan ka khata). Wallet na ho to
-- doodh nahi rukta.

create or replace function public.fn_apply_milk_fat(
  p_entry_id uuid,
  p_fat numeric,
  p_by uuid,
  p_allow_override boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.milk_entries%rowtype;
  v_name text;
  v_phone text;
  v_type text;
  v_rate numeric;
  v_incentive numeric;
  v_snf_c numeric;
  v_ref numeric;
  v_snf numeric;
  v_ts numeric;
  v_adj numeric;
  v_amount numeric;
  v_label text;
  v_ledger uuid;
  v_wallet_id uuid;
  v_wallet_txn uuid;
  v_claims jsonb;
  v_backdate text;
  v_collected timestamptz;
begin
  if p_entry_id is null then
    raise exception 'Entry nahi mili.';
  end if;
  if p_fat is null or p_fat <= 0 then
    raise exception 'FAT sahi likhein.';
  end if;
  if not coalesce(p_allow_override, false) and (p_fat < 1 or p_fat > 12) then
    raise exception 'FAT 1 se 12 ke darmiyan hona chahiye. Ghalat adad ho to manager override lagayein.';
  end if;

  select * into e from public.milk_entries where id = p_entry_id for update;
  if not found then
    raise exception 'Entry nahi mili.';
  end if;
  if e.status <> 'pending_fat' then
    raise exception 'Is par FAT pehle hi lag chuka hai.';
  end if;
  if e.lr is null then
    raise exception 'LR ke baghair rate nahi ban sakta — pehle LR bharein.';
  end if;
  if not coalesce(e.lr_override, false) and (e.lr < 15 or e.lr > 40) then
    raise exception 'LR 15 se 40 ke darmiyan hona chahiye.';
  end if;
  if e.possible_duplicate_of is not null and e.duplicate_cleared_at is null then
    raise exception 'Mumkin duplicate hai. Manager pehle nishan saaf kare, phir FAT lagayein.';
  end if;

  select f.full_name, f.phone_number, f.milk_collection_type
    into v_name, v_phone, v_type
  from public.farmers f
  where f.id = e.farmer_id;
  if not found then
    raise exception 'Farmer nahi mila.';
  end if;

  select s.standard_rate, s.self_dropoff_incentive, s.snf_constant, s.reference_ts
    into v_rate, v_incentive, v_snf_c, v_ref
  from public.milk_rate_settings s
  limit 1;
  if v_rate is null or v_rate <= 0 or v_incentive is null or v_snf_c is null or v_ref is null or v_ref = 0 then
    raise exception 'Doodh ka rate settings mein nahi. Andaza nahi lagate — pehle rate darj karein.';
  end if;
  if v_type = 'self_dropoff' then
    v_rate := v_rate + v_incentive;
  end if;

  v_snf := round((e.lr / 4) + (p_fat * 0.2) + v_snf_c, 2);
  v_ts := round(p_fat + v_snf, 2);
  v_adj := round(e.quantity_liters * (v_ts / v_ref), 2);
  v_amount := round(v_adj * v_rate, 2);
  if v_amount is null or v_amount <= 0 then
    raise exception 'Raqam nahi bani. FAT, LR aur rate dobara dekhein.';
  end if;

  v_label := format('Milk: %sL, Fat %s%%, %s (%s) — %s', e.quantity_liters, p_fat, e.entry_date, e.shift, coalesce(e.collection_number, ''));

  update public.milk_entries set
    fat_percentage = p_fat,
    snf_percentage = v_snf,
    ts_value = v_ts,
    adjusted_volume = v_adj,
    rate_per_liter = v_rate,
    total_amount = v_amount,
    status = 'priced',
    fat_by_profile_id = p_by,
    fat_at = now(),
    fat_override = coalesce(p_allow_override, false) and (p_fat < 1 or p_fat > 12)
  where id = p_entry_id and status = 'pending_fat';
  if not found then
    raise exception 'Is par FAT pehle hi lag chuka hai.';
  end if;

  insert into public.farmer_credit_ledger (
    farmer_id, source_type, ledger_type, amount, balance_after, reference_id, notes, created_by
  ) values (
    e.farmer_id, 'milk', 'credit', v_amount, 0, p_entry_id, v_label, p_by
  ) returning id into v_ledger;

  v_claims := jsonb_build_array(jsonb_build_object('table', 'farmer_credit_ledger', 'rowId', v_ledger));

  select w.id into v_wallet_id
  from public.wallets w
  where w.owner_type = 'farmer' and w.owner_id = e.farmer_id
  for update;
  if v_wallet_id is not null then
    insert into public.wallet_transactions (
      wallet_id, type, direction, amount, balance_after, reference_type, reference_id, notes, created_by
    ) values (
      v_wallet_id, 'milk_income', 'credit', v_amount, 0, 'milk_entry', p_entry_id, v_label, p_by
    ) returning id into v_wallet_txn;
    v_claims := v_claims || jsonb_build_array(jsonb_build_object('table', 'wallet_transactions', 'rowId', v_wallet_txn));
  end if;

  v_backdate := null;
  if e.entry_date < (now() at time zone 'Asia/Karachi')::date then
    v_backdate := 'Doodh pehle jama hua, FAT baad mein laga';
  end if;
  v_collected := coalesce(e.collected_at, now());

  perform public.post_journal_atomic(jsonb_build_object(
    'description', v_label,
    'sourceModule', 'farmer_credit',
    'sourceId', e.farmer_id,
    'branchId', e.branch_id,
    'entryDate', e.entry_date,
    'backdateReason', v_backdate,
    'createdBy', p_by,
    'lines', jsonb_build_array(
      jsonb_build_object('account', '5010', 'debit', v_amount, 'memo', v_label),
      jsonb_build_object('account', '1150', 'credit', v_amount, 'partyType', 'farmer', 'partyId', e.farmer_id, 'memo', v_label)
    ),
    'claims', v_claims
  ));

  return jsonb_build_object(
    'collection_number', coalesce(e.collection_number, ''),
    'snf', v_snf,
    'ts', v_ts,
    'adjusted_volume', v_adj,
    'amount', v_amount,
    'rate_per_liter', v_rate,
    'farmer_name', coalesce(v_name, 'Kisan'),
    'phone_number', v_phone,
    'collected_at', v_collected,
    'liters', e.quantity_liters,
    'fat', p_fat,
    'lr', e.lr
  );
end $$;

revoke all on function public.fn_apply_milk_fat(uuid, numeric, uuid, boolean) from public, anon, authenticated;

create or replace function public.fn_clear_milk_duplicate(p_entry uuid, p_by uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.milk_entries%rowtype;
begin
  if p_by is null then
    raise exception 'Login zaroori hai.';
  end if;
  if p_note is null or length(btrim(p_note)) < 5 then
    raise exception 'Nishan saaf karne ki wajah kam az kam 5 haroof ki likhein.';
  end if;
  select * into e from public.milk_entries where id = p_entry for update;
  if not found then
    raise exception 'Entry nahi mili.';
  end if;
  if e.possible_duplicate_of is null then
    raise exception 'Is par duplicate ka nishan nahi.';
  end if;
  if e.created_by is not null and e.created_by = p_by then
    raise exception 'Apni entry ka duplicate nishan khud saaf nahi kar sakte.';
  end if;
  update public.milk_entries set
    duplicate_cleared_by = p_by,
    duplicate_cleared_at = now(),
    duplicate_clear_note = left(btrim(p_note), 255)
  where id = p_entry;
end $$;

revoke all on function public.fn_clear_milk_duplicate(uuid, uuid, text) from public, anon, authenticated;

do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_apply_milk_fat(uuid, numeric, uuid, boolean) to service_role;
    grant execute on function public.fn_clear_milk_duplicate(uuid, uuid, text) to service_role;
  end if;
end
$g$;
