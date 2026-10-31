-- =====================================================================
-- 730: Handover phone digits, chiller SNF 3 hisse, andaruni rate
-- =====================================================================
-- Phone "Milk TS% Volume" (1 L, fat 4.3, LR 27, TS 13, temp khali):
--   SNF 8.416, TS 12.717, adjusted 0.979, SG 1.027, kg 1.027.
-- SNF constant ka naya DEFAULT 0.806. Maujooda 0.805 ki qatar UPDATE
-- nahi — kisan ki adaigi fn_apply_milk_fat usi par rehti hai.
-- Handover code 0.805 ko purana paper default maanta hai aur 0.806
-- lagata hai, jab tak Owner koi aur constant na likhe.
--
-- milk_dispatch_lines.snf ab 3 hisse. Save round(..., 3).
-- ts_percentage generated half-up hai; form phone ceiling khud dikhata hai
-- (12.716 stored vs 12.717 screen ho sakta hai). App ye column nahi parhta.
--
-- milk_dispatch_rates sirf Owner/Admin/Super Admin. Print, WhatsApp,
-- Email is table ko nahi chhute. Staff select RLS se khali.
--
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 730_milk_handover_phone_rate.rollback.sql

alter table public.milk_rate_settings
  alter column snf_constant set default 0.806;

comment on column public.milk_rate_settings.snf_constant is
  'Naya default 0.806 (phone handover). Maujooda 0.805 UPDATE nahi — kisan ki adaigi fn_apply_milk_fat usi qatar par. Handover 0.805 ko purana paper default samajh kar 0.806 lagata hai jab tak Owner koi aur constant na likhe (730).';

alter table public.milk_dispatch_lines drop column if exists ts_percentage;

alter table public.milk_dispatch_lines
  alter column snf_percentage type numeric(6,3);

alter table public.milk_dispatch_lines
  add column ts_percentage numeric(7,3) generated always as (
    case
      when fat_percentage is null or snf_percentage is null then null
      else round(fat_percentage + snf_percentage, 3)
    end
  ) stored;

create or replace function public.fn_save_milk_handover(
  p_by uuid,
  p_id uuid,
  p_branch_id uuid,
  p_shop_id uuid,
  p_date date,
  p_shift text,
  p_collection_time time,
  p_mcc_name text,
  p_vehicle text,
  p_driver text,
  p_notes text,
  p_accepted boolean,
  p_rejection_reason text,
  p_licensee_rep_name text,
  p_licensee_signature text,
  p_collector_signature text,
  p_lines jsonb,
  p_destination text default 'company',
  p_party_id uuid default null,
  p_handover_reason text default null,
  p_lr_baseline integer default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_active boolean;
  v_home uuid;
  v_branch_name text;
  v_shop_name text;
  v_shop_branch uuid;
  v_mcc text;
  v_reason text;
  v_notes text;
  v_vehicle text;
  v_driver text;
  v_rep text;
  v_lic text;
  v_col text;
  v_shift text;
  e public.milk_dispatches%rowtype;
  r record;
  v_clean jsonb := '[]'::jsonb;
  v_chiller text;
  v_type text;
  v_organo text;
  v_gross numeric;
  v_fat numeric;
  v_lr numeric;
  v_snf numeric;
  v_adj numeric;
  v_temp numeric;
  v_sum numeric(14,3) := 0;
  v_fat_w numeric := 0;
  v_fat_base numeric := 0;
  v_snf_w numeric := 0;
  v_snf_base numeric := 0;
  v_n integer := 0;
  v_id uuid;
  v_header_fat numeric(5,2);
  v_header_snf numeric(5,2);
  v_dest text;
  v_hand text;
  v_base smallint;
  v_party_active boolean;
begin
  if p_by is null then
    raise exception 'Login zaroori hai.';
  end if;

  select role::text, is_active, branch_id
    into v_role, v_active, v_home
  from public.profiles
  where id = p_by;

  if v_active is distinct from true then
    raise exception 'Ye account fa''aal nahi hai.';
  end if;
  if v_role is null or v_role not in ('owner', 'super_admin', 'admin', 'manager', 'milk_collection') then
    raise exception 'Aapko is kaam ki ijazat nahi hai.';
  end if;

  if p_branch_id is null then
    raise exception 'Branch (MCC) chunein.';
  end if;
  if p_date is null then
    raise exception 'Tareekh likhein.';
  end if;
  if p_date > (current_date + 1) or p_date < date '2020-01-01' then
    raise exception 'Tareekh 2020 se kal tak ho sakti hai.';
  end if;

  v_shift := lower(btrim(coalesce(p_shift, '')));
  if v_shift not in ('morning', 'evening') then
    raise exception 'Shift subah ya shaam honi chahiye.';
  end if;

  select name into v_branch_name from public.branches where id = p_branch_id;
  if v_branch_name is null then
    raise exception 'Branch nahi mili.';
  end if;

  if p_shop_id is not null then
    select name, branch_id into v_shop_name, v_shop_branch
    from public.shops
    where id = p_shop_id and coalesce(is_active, true);
    if v_shop_name is null then
      raise exception 'MCC (dukaan) nahi mili.';
    end if;
    if v_shop_branch is not null and v_shop_branch <> p_branch_id then
      raise exception 'Ye MCC is branch ki nahi.';
    end if;
  end if;

  if v_role in ('manager', 'milk_collection') and v_home is not null then
    if p_branch_id <> v_home then
      raise exception 'Doosri branch par nahi likh sakte.';
    end if;
  end if;

  v_mcc := nullif(btrim(coalesce(p_mcc_name, '')), '');
  if v_mcc is null then
    v_mcc := coalesce(v_shop_name, v_branch_name);
  end if;
  if char_length(v_mcc) > 120 then
    raise exception 'MCC naam 120 haroof se chhota rakhein.';
  end if;

  v_reason := nullif(btrim(coalesce(p_rejection_reason, '')), '');
  if p_accepted is true then
    v_reason := null;
  elsif p_accepted is false then
    if v_reason is null or char_length(v_reason) < 3 then
      raise exception 'Radd ki wajah kam az kam 3 haroof ki likhein.';
    end if;
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Radd ki wajah 500 haroof se chhoti rakhein.';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  v_vehicle := nullif(btrim(coalesce(p_vehicle, '')), '');
  v_driver := nullif(btrim(coalesce(p_driver, '')), '');
  v_rep := nullif(btrim(coalesce(p_licensee_rep_name, '')), '');
  v_lic := nullif(btrim(coalesce(p_licensee_signature, '')), '');
  v_col := nullif(btrim(coalesce(p_collector_signature, '')), '');
  if v_rep is not null and char_length(v_rep) > 120 then
    raise exception 'Licensee ka naam 120 haroof se chhota rakhein.';
  end if;
  if v_lic is not null and char_length(v_lic) > 120 then
    raise exception 'Licensee dastakhat 120 haroof se chhota rakhein.';
  end if;
  if v_col is not null and char_length(v_col) > 120 then
    raise exception 'Collector dastakhat 120 haroof se chhota rakhein.';
  end if;

  v_dest := lower(btrim(coalesce(p_destination, 'company')));
  if v_dest not in ('company', 'vendor', 'party') then
    raise exception 'Manzil company, vendor ya party honi chahiye.';
  end if;
  -- Company hamesha 20. Vendor hamesha 22.
  -- Party default 20 (company agreement): achha doodh bhi teesri party ko
  -- ja sakta hai. Staff 22 chun sake. Slip lr_baseline par wahi likhti hai.
  if v_dest = 'vendor' then
    v_base := 22;
  elsif v_dest = 'company' then
    v_base := 20;
  else
    v_base := case when p_lr_baseline = 22 then 22 else 20 end;
  end if;
  if v_dest = 'party' then
    v_hand := nullif(lower(btrim(coalesce(p_handover_reason, ''))), '');
    if v_hand is not null and v_hand not in ('sale', 'given', 'spoil', 'other') then
      raise exception 'Wajah sale, given, spoil ya other ho sakti hai. Khali bhi theek hai — kharab lazmi nahi.';
    end if;
  else
    v_hand := null;
  end if;

  if p_id is not null then
    select * into e from public.milk_dispatches where id = p_id for update;
    if not found then
      raise exception 'Ye certificate nahi mila.';
    end if;
    if v_role in ('manager', 'milk_collection') and v_home is not null and e.branch_id is distinct from v_home then
      raise exception 'Ye aapki branch ki rawangi nahi.';
    end if;

    if e.destination is distinct from v_dest then
      raise exception 'Is slip ki manzil nahi badalti. Company, vendor aur party alag certificate hain.';
    end if;

    if e.received_liters is not null then
      if p_lines is not null then
        raise exception 'Raseed aa chuki hai. Chiller ki miqdar ab nahi badlegi.';
      end if;
      update public.milk_dispatches set
        accepted = p_accepted,
        rejection_reason = v_reason,
        licensee_rep_name = v_rep,
        licensee_signature = v_lic,
        licensee_signed_at = case
          when v_lic is null then null
          when v_lic is not distinct from e.licensee_signature then e.licensee_signed_at
          else now()
        end,
        licensee_signed_by = case
          when v_lic is null then null
          when v_lic is not distinct from e.licensee_signature then e.licensee_signed_by
          else p_by
        end,
        collector_signature = v_col,
        collector_signed_at = case
          when v_col is null then null
          when v_col is not distinct from e.collector_signature then e.collector_signed_at
          else now()
        end,
        collector_signed_by = case
          when v_col is null then null
          when v_col is not distinct from e.collector_signature then e.collector_signed_by
          else p_by
        end,
        notes = v_notes
      where id = p_id;
      return p_id;
    end if;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Chiller ki qatarein nahi aayin.';
  end if;

  for r in
    select *
    from jsonb_to_recordset(p_lines) as x(
      chiller_no text,
      milk_type text,
      gross_volume_l numeric,
      fat_percentage numeric,
      lr numeric,
      snf_percentage numeric,
      adjusted_volume_l numeric,
      temperature_c numeric,
      organo text
    )
  loop
    v_chiller := nullif(btrim(coalesce(r.chiller_no, '')), '');
    v_type := nullif(btrim(coalesce(r.milk_type, '')), '');
    v_organo := nullif(btrim(coalesce(r.organo, '')), '');
    if v_chiller is null and v_type is null and v_organo is null
       and r.gross_volume_l is null and r.fat_percentage is null and r.lr is null
       and r.snf_percentage is null and r.adjusted_volume_l is null and r.temperature_c is null then
      continue;
    end if;

    if v_chiller is null then
      raise exception 'Chiller number likhein.';
    end if;
    if v_type is null then
      raise exception 'Chiller % ka milk type likhein (Cow, Buffalo, Mixed).', v_chiller;
    end if;
    if r.gross_volume_l is null then
      raise exception 'Chiller % ki miqdar (Gross Vol) likhein.', v_chiller;
    end if;
    v_gross := round(r.gross_volume_l, 3);
    v_fat := case when r.fat_percentage is null then null else round(r.fat_percentage, 2) end;
    v_lr := case when r.lr is null then null else round(r.lr, 2) end;
    v_snf := case when r.snf_percentage is null then null else round(r.snf_percentage, 3) end;
    v_adj := case when r.adjusted_volume_l is null then null else round(r.adjusted_volume_l, 3) end;
    v_temp := case when r.temperature_c is null then null else round(r.temperature_c, 2) end;

    if v_gross < 0 or v_gross > 100000 then
      raise exception 'Chiller % ki miqdar 0 se 100000 litre ke darmiyan ho.', v_chiller;
    end if;
    if v_fat is not null and (v_fat <= 0 or v_fat > 20) then
      raise exception 'Chiller % ka FAT 0 se 20 ke darmiyan likhein.', v_chiller;
    end if;
    if v_lr is not null and (v_lr <= 0 or v_lr > 60) then
      raise exception 'Chiller % ka LR 0 se 60 ke darmiyan likhein.', v_chiller;
    end if;
    if v_snf is not null and (v_snf <= 0 or v_snf > 20) then
      raise exception 'Chiller % ka SNF 0 se 20 ke darmiyan likhein.', v_chiller;
    end if;
    if v_adj is not null and (v_adj < 0 or v_adj > 100000) then
      raise exception 'Chiller % ka adjusted volume theek nahi.', v_chiller;
    end if;
    if v_temp is not null and (v_temp < -5 or v_temp > 60) then
      raise exception 'Chiller % ka temperature -5 se 60 ke darmiyan ho.', v_chiller;
    end if;
    if v_organo is not null and char_length(v_organo) > 40 then
      raise exception 'Chiller % ka organo 40 haroof se chhota rakhein.', v_chiller;
    end if;

    v_n := v_n + 1;
    if v_n > 30 then
      raise exception 'Ek certificate par 30 se zyada chiller nahi.';
    end if;
    v_sum := v_sum + v_gross;
    if v_fat is not null and v_gross > 0 then
      v_fat_w := v_fat_w + (v_gross * v_fat);
      v_fat_base := v_fat_base + v_gross;
    end if;
    if v_snf is not null and v_gross > 0 then
      v_snf_w := v_snf_w + (v_gross * v_snf);
      v_snf_base := v_snf_base + v_gross;
    end if;

    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'line_no', v_n,
      'chiller_no', v_chiller,
      'milk_type', v_type,
      'gross_volume_l', v_gross,
      'fat_percentage', v_fat,
      'lr', v_lr,
      'snf_percentage', v_snf,
      'adjusted_volume_l', v_adj,
      'temperature_c', v_temp,
      'organo', v_organo
    ));
  end loop;

  if v_n = 0 or v_sum <= 0 then
    raise exception 'Kam az kam ek chiller ki miqdar likhein. Khali certificate mehfooz nahi hota.';
  end if;

  if v_dest = 'party' then
    if p_party_id is null then
      raise exception 'Party chunein.';
    end if;
    select p.is_active into v_party_active
    from public.milk_handover_parties p
    where p.id = p_party_id;
    if not found then
      raise exception 'Party nahi mili.';
    end if;
    if v_party_active is distinct from true then
      if p_id is null then
        raise exception 'Ye party band hai. Fa''aal party chunein.';
      elsif e.party_id is distinct from p_party_id then
        raise exception 'Ye party band hai. Fa''aal party chunein.';
      end if;
    end if;
  elsif p_party_id is not null then
    raise exception 'Party sirf teesri manzil par chunti hai.';
  end if;

  if exists (
    select 1 from public.milk_dispatches d
    where d.branch_id = p_branch_id
      and d.dispatch_date = p_date
      and d.shift = v_shift
      and d.destination = v_dest
      and (v_dest <> 'party' or d.party_id = p_party_id)
      and (p_id is null or d.id <> p_id)
  ) then
    raise exception 'Is branch ki is tareekh aur shift ki rawangi pehle se darj hai. Fehrist se wahi certificate kholen.';
  end if;

  v_header_fat := case when v_fat_base > 0 then round(v_fat_w / v_fat_base, 2) else null end;
  v_header_snf := case when v_snf_base > 0 then round(v_snf_w / v_snf_base, 2) else null end;

  if p_id is null then
    insert into public.milk_dispatches (
      branch_id, shop_id, dispatch_date, shift, collection_time, mcc_name,
      dispatched_liters, fat_percentage, snf_percentage,
      vehicle_name, driver_name, notes,
      accepted, rejection_reason, licensee_rep_name,
      licensee_signature, licensee_signed_at, licensee_signed_by,
      collector_signature, collector_signed_at, collector_signed_by,
      created_by, destination, party_id, handover_reason, lr_baseline
    ) values (
      p_branch_id, p_shop_id, p_date, v_shift, p_collection_time, v_mcc,
      v_sum, v_header_fat, v_header_snf,
      v_vehicle, v_driver, v_notes,
      p_accepted, v_reason, v_rep,
      v_lic, case when v_lic is null then null else now() end, case when v_lic is null then null else p_by end,
      v_col, case when v_col is null then null else now() end, case when v_col is null then null else p_by end,
      p_by, v_dest, case when v_dest = 'party' then p_party_id else null end, v_hand, v_base
    )
    returning id into v_id;
  else
    perform set_config('agribridge.milk_handover_edit', 'on', true);
    update public.milk_dispatches set
      branch_id = p_branch_id,
      shop_id = p_shop_id,
      dispatch_date = p_date,
      shift = v_shift,
      collection_time = p_collection_time,
      mcc_name = v_mcc,
      dispatched_liters = v_sum,
      fat_percentage = v_header_fat,
      snf_percentage = v_header_snf,
      vehicle_name = v_vehicle,
      driver_name = v_driver,
      notes = v_notes,
      accepted = p_accepted,
      rejection_reason = v_reason,
      licensee_rep_name = v_rep,
      licensee_signature = v_lic,
      licensee_signed_at = case
        when v_lic is null then null
        when v_lic is not distinct from e.licensee_signature then e.licensee_signed_at
        else now()
      end,
      licensee_signed_by = case
        when v_lic is null then null
        when v_lic is not distinct from e.licensee_signature then e.licensee_signed_by
        else p_by
      end,
      collector_signature = v_col,
      collector_signed_at = case
        when v_col is null then null
        when v_col is not distinct from e.collector_signature then e.collector_signed_at
        else now()
      end,
      collector_signed_by = case
        when v_col is null then null
        when v_col is not distinct from e.collector_signature then e.collector_signed_by
        else p_by
      end,
      destination = v_dest,
      party_id = case when v_dest = 'party' then p_party_id else null end,
      handover_reason = v_hand,
      lr_baseline = v_base
    where id = p_id;
    v_id := p_id;
    delete from public.milk_dispatch_lines where dispatch_id = v_id;
  end if;

  insert into public.milk_dispatch_lines (
    dispatch_id, line_no, chiller_no, milk_type, gross_volume_l,
    fat_percentage, lr, snf_percentage, adjusted_volume_l, temperature_c, organo
  )
  select
    v_id,
    (x.line_no)::integer,
    x.chiller_no,
    x.milk_type,
    x.gross_volume_l,
    x.fat_percentage,
    x.lr,
    x.snf_percentage,
    x.adjusted_volume_l,
    x.temperature_c,
    x.organo
  from jsonb_to_recordset(v_clean) as x(
    line_no integer,
    chiller_no text,
    milk_type text,
    gross_volume_l numeric,
    fat_percentage numeric,
    lr numeric,
    snf_percentage numeric,
    adjusted_volume_l numeric,
    temperature_c numeric,
    organo text
  );

  return v_id;
end $$;



revoke all on function public.fn_save_milk_handover(
  uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb, text, uuid, text, integer
) from public, anon, authenticated;


create table if not exists public.milk_dispatch_rates (
  dispatch_id uuid primary key references public.milk_dispatches(id) on delete cascade,
  rate_per_adjusted_l numeric(12,2) not null check (rate_per_adjusted_l >= 0),
  amount numeric(14,2) not null check (amount >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

comment on table public.milk_dispatch_rates is
  'Handover ka andaruni rate (Rs per adjusted L) aur amount. Sirf Owner/Admin. Slip par nahi (730).';

alter table public.milk_dispatch_rates enable row level security;

drop policy if exists milk_dispatch_rates_admin on public.milk_dispatch_rates;
create policy milk_dispatch_rates_admin on public.milk_dispatch_rates
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.role in ('owner', 'super_admin', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.role in ('owner', 'super_admin', 'admin')
    )
  );

revoke all on public.milk_dispatch_rates from public, anon, authenticated;
grant select, insert, update, delete on public.milk_dispatch_rates to authenticated;

do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on public.milk_dispatch_rates to service_role;
  end if;
end
$g$;

update public.feature_help set
  how_steps = how_steps || array[
    'Chiller number (jaise HM) qatar par mehfooz rehta hai. Staff Fat, LR, gross usi qatar par likhte hain. Number badalne ke liye Edit — har keystroke se number nahi mit-ta.',
    'SNF, TS aur adjusted teen hisse, phone jaisa. Misal 1 L, fat 4.3, LR 27, TS 13: SNF 8.416, TS 12.717, adjusted 0.979. Sp. Gravity aur Milk kg bhi. Ye print aur slip par hain.',
    'Rate (Rs per adjusted L) aur amount sirf Admin/Owner. Company, Vendor aur Party teeno form par. Print, WhatsApp aur Email par rate ya amount nahi.'
  ],
  mistakes = mistakes || array[
    'Chiller number mitana jab sirf lab likhna ho. Edit ke baghair number band rehta hai.',
    'Rate ya amount ko print, WhatsApp ya email par bhej dena. Wo sirf andaruni hisaab hai.'
  ]
where feature_key = 'milk-collection.handover' and lang = 'rm';

update public.feature_help set
  how_steps = how_steps || array[
    'The chiller number (for example HM) stays on the row. Staff type fat, LR and gross on that row. Use Edit to change the number — typing in other boxes does not clear it.',
    'SNF, TS and adjusted use three decimals, the same as the phone. Example 1 L, fat 4.3, LR 27, TS 13: SNF 8.416, TS 12.717, adjusted 0.979. Specific gravity and milk kg are on the slip too.',
    'Rate (Rs per adjusted litre) and amount are Admin/Owner only, on Company, Vendor and Party forms. Print, WhatsApp and Email do not include them.'
  ],
  mistakes = mistakes || array[
    'Clearing the chiller number while only the lab should change. Without Edit the number stays locked.',
    'Putting rate or amount on the print, WhatsApp or email slip. That figure is internal.'
  ]
where feature_key = 'milk-collection.handover' and lang = 'en';

update public.feature_help set
  how_steps = how_steps || array[
    'چلر نمبر (جیسے HM) قطار پر رہتا ہے۔ ایڈٹ سے ہی بدلیں۔',
    'SNF، TS، ایڈجسٹڈ تین ہندسے، فون جیسا۔ ریٹ اور رقم صرف ایڈمن، سلپ پر نہیں۔'
  ],
  mistakes = mistakes || array[
    'چلر نمبر مٹا دینا۔',
    'ریٹ سلپ پر بھیج دینا۔'
  ]
where feature_key = 'milk-collection.handover' and lang = 'ur';
