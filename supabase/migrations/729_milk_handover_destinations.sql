-- =====================================================================
-- 729: Milk Handover — Company, Vendor, Party
-- =====================================================================
-- 728 ke baad. Pehle Testing. Live par tab jab backup verify ho.
-- Purani rawangi company ban jati hai. Litre nahi bharta.
--
--   destination   company | vendor | party
--   lr_baseline   company hamesha 20, vendor hamesha 22
--   party         staff 20 (default) ya 22 chunta hai — lock nahi
--                 default 20 is liye ke teesri party ko achha doodh bhi
--                 ja sakta hai. Slip par wahi recipe jo chuni gayi.
--   handover_reason  sirf party: sale, given, spoil, other, ya khali.
--                 kharab lazmi nahi.
--
-- Ek branch + tareekh + shift: ek company, ek vendor, aur har party ki
-- apni slip. Purana unique index (sirf shift) hata.
-- Rollback: 729_milk_handover_destinations.rollback.sql
-- =====================================================================

alter table public.milk_dispatches
  add column if not exists lr_baseline smallint not null default 20;

alter table public.milk_dispatches drop constraint if exists milk_dispatches_lr_baseline;
alter table public.milk_dispatches
  add constraint milk_dispatches_lr_baseline check (lr_baseline in (20, 22));

alter table public.milk_dispatches
  add column if not exists destination text not null default 'company',
  add column if not exists party_id uuid,
  add column if not exists handover_reason text;

comment on column public.milk_dispatches.destination is
  'Handover manzil: company (LR 20), vendor (LR 22), party (staff 20 ya 22). Purani rawangi company (729).';
comment on column public.milk_dispatches.handover_reason is
  'Sirf party. sale, given, spoil, other, ya khali. Kharab lazmi nahi. Achha doodh bhi teesri party ko ja sakta hai (729).';
comment on column public.milk_dispatches.lr_baseline is
  'Company hamesha 20. Vendor hamesha 22. Party par staff 20 (default) ya 22 chunta hai. Slip par wahi (729).';

create table if not exists public.milk_handover_parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milk_handover_parties_name check (char_length(btrim(name)) between 2 and 120),
  constraint milk_handover_parties_contact check (contact is null or char_length(contact) <= 80)
);

create unique index if not exists milk_handover_parties_active_name
  on public.milk_handover_parties (lower(btrim(name)))
  where is_active;

comment on table public.milk_handover_parties is
  'Handover ki teesri party: naam, rabta, faal. Achha doodh bhi, sirf kharab nahi (729).';

alter table public.milk_handover_parties enable row level security;
drop policy if exists milk_handover_parties_select on public.milk_handover_parties;
create policy milk_handover_parties_select on public.milk_handover_parties
  for select to authenticated
  using (public.fn_is_any_staff());

revoke all on public.milk_handover_parties from public, anon, authenticated;
grant select on public.milk_handover_parties to authenticated;

do $fk$
begin
  if not exists (select 1 from pg_constraint where conname = 'milk_dispatches_party_id_fkey') then
    alter table public.milk_dispatches
      add constraint milk_dispatches_party_id_fkey
      foreign key (party_id) references public.milk_handover_parties(id);
  end if;
end
$fk$;

alter table public.milk_dispatches drop constraint if exists milk_dispatches_destination;
alter table public.milk_dispatches
  add constraint milk_dispatches_destination check (destination in ('company', 'vendor', 'party'));

alter table public.milk_dispatches drop constraint if exists milk_dispatches_destination_party;
alter table public.milk_dispatches add constraint milk_dispatches_destination_party check (
  (destination = 'party' and party_id is not null)
  or (destination in ('company', 'vendor') and party_id is null)
);

alter table public.milk_dispatches drop constraint if exists milk_dispatches_handover_reason;
alter table public.milk_dispatches add constraint milk_dispatches_handover_reason check (
  handover_reason is null
  or (destination = 'party' and handover_reason in ('sale', 'given', 'spoil', 'other'))
);

drop index if exists public.milk_dispatch_one_per_shift;
create unique index if not exists milk_dispatch_one_company
  on public.milk_dispatches (branch_id, dispatch_date, shift)
  where destination = 'company';
create unique index if not exists milk_dispatch_one_vendor
  on public.milk_dispatches (branch_id, dispatch_date, shift)
  where destination = 'vendor';
create unique index if not exists milk_dispatch_one_party
  on public.milk_dispatches (branch_id, dispatch_date, shift, party_id)
  where destination = 'party';
create index if not exists idx_milk_dispatches_party
  on public.milk_dispatches (party_id)
  where party_id is not null;
create index if not exists idx_milk_dispatches_destination_date
  on public.milk_dispatches (destination, dispatch_date desc);

drop function if exists public.fn_save_milk_handover(
  uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb
);
drop function if exists public.fn_save_milk_handover(
  uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb, text, uuid, text, integer
);

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
    v_snf := case when r.snf_percentage is null then null else round(r.snf_percentage, 2) end;
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

create or replace function public.fn_save_milk_handover_party(
  p_by uuid,
  p_id uuid,
  p_name text,
  p_contact text,
  p_active boolean
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_active boolean;
  v_name text;
  v_contact text;
  v_id uuid;
  v_on boolean;
begin
  if p_by is null then
    raise exception 'Login zaroori hai.';
  end if;
  select role::text, is_active into v_role, v_active
  from public.profiles where id = p_by;
  if v_active is distinct from true then
    raise exception 'Ye account fa''aal nahi hai.';
  end if;
  if v_role is null or v_role not in ('owner', 'super_admin', 'admin', 'manager', 'milk_collection') then
    raise exception 'Aapko is kaam ki ijazat nahi hai.';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Party ka naam 2 se 120 haroof ka hon.';
  end if;
  v_contact := nullif(btrim(coalesce(p_contact, '')), '');
  if v_contact is not null and char_length(v_contact) > 80 then
    raise exception 'Party ka rabta 80 haroof se chhota rakhein.';
  end if;
  v_on := coalesce(p_active, true);

  if p_id is null then
    insert into public.milk_handover_parties (name, contact, is_active, created_by)
    values (v_name, v_contact, v_on, p_by)
    returning id into v_id;
  else
    update public.milk_handover_parties
      set name = v_name,
          contact = v_contact,
          is_active = v_on,
          updated_at = now()
      where id = p_id
      returning id into v_id;
    if v_id is null then
      raise exception 'Party nahi mili.';
    end if;
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'Is naam ki fa''aal party pehle se hai.';
end $$;

revoke all on function public.fn_save_milk_handover_party(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;

do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_save_milk_handover(
      uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb, text, uuid, text, integer
    ) to service_role;
    grant execute on function public.fn_save_milk_handover_party(uuid, uuid, text, text, boolean) to service_role;
    grant select, insert, update, delete on public.milk_handover_parties to service_role;
  end if;
end
$g$;

comment on function public.fn_save_milk_handover(
  uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb, text, uuid, text, integer
) is
  'Handover slip. Company LR 20, vendor LR 22, party par 20 ya 22. Raseed ke baad sirf faisla aur dastakhat (729).';


update public.features set
  label = 'Milk Handover — Company, Vendor, Party',
  label_en = 'Milk Handover — Company, Vendor, Party',
  description = 'Teen alag slip: Company (LR 20), Vendor (LR 22), Party (20 ya 22 chunein). Roz ka khulasa: chiller in, teen out, farq. Raseed har manzil ki alag.',
  description_en = 'Three slips: Company (LR 20), Vendor (LR 22), Party (choose 20 or 22). Daily summary: chiller in, three outs, variance. Receipt per destination.',
  description_ur = 'تین سلپ: کمپنی ۲۰، وینڈر ۲۲، پارٹی ۲۰ یا ۲۲۔ روز کا خلاصہ۔ رسید ہر منزل کی الگ۔'
where key = 'milk-collection.handover';

update public.feature_help set
  purpose = 'Teen alag handover: Company, Vendor, aur Party. Har ek ka apna form aur slip. Chiller grid ek jaisa. Party par recipe 20 ya 22 staff chunta hai.',
  who_uses = 'MCC / doodh ka staff aur manager. Apni branch. Party master bhi yahin.',
  when_use = 'Jab doodh company ko jaye, vendor ko jaye, ya teesri party ko becha ya diya jaye. Kharab doodh sirf ek wajah hai, poora flow nahi.',
  how_steps = array[
    'Roz ka khulasa kholen: MCC chiller par kitna aaya, Company / Vendor / Party ko kitna gaya, aur farq. Raseed har manzil ki alag hai.',
    'Company ka apna form. LR recipe 20°C. Vendor ka apna form. LR recipe 22°C. Dono par chiller: number, milk type, gross, FAT, LR, temperature, organo. SNF, TS aur adjusted usi recipe se.',
    'Party ka apna form. Party master se chunein ya naya naam aur rabta likhein. Recipe 20 ya 22 khud chunein — lock nahi. Default 20°C hai, kyunke achha doodh bhi teesri party ko ja sakta hai. 22°C vendor ki chart hai. Slip par wahi recipe likhti hai jo aap chunen.',
    'Wajah optional hai: bechna, de diya, kharab, ya aur. Kharab lazmi nahi. Khali chhorna theek hai.',
    'Har slip par Print, WhatsApp aur Email. Un par manzil aur recipe ka naam hota hai.',
    'Raseed Doodh ki Rawangi par, har slip ki alag. Raseed na ho to us slip ka farq nahi — sifar mat parhein. Chiller intake darj na ho to din ka farq bhi nahi.'
  ],
  mistakes = array[
    'Company aur Vendor ko ek form samajhna. Dono alag hain: 20 aur 22.',
    'Party ko sirf kharab doodh samajhna. Achha doodh bhi ja sakta hai.',
    'Party par recipe lock samajhna. 20 default hai, 22 chuna ja sakta hai. Slip batati hai kaun si lagi.',
    '20 aur 22 ko ek chart samajhna. 32°C par company +4 hai, vendor +3.',
    'Jis manzil par slip nahi us ko chhupana. Khulasa 0 L gaya likhta hai. Chiller intake na ho to farq sifar nahi.',
    'Raseed ko teen out ke farq mein milana. Raseed alag hai.'
  ],
  next_step = 'Slip mehfooz karein, phir Print, WhatsApp ya Email. Raseed aaye to Rawangi par usi slip ka litre. Din ka khulasa teen out aur farq dikhata hai.',
  related = array['milk-collection.dispatch','milk-collection.chiller','milk-collection.billing']::text[]
where feature_key = 'milk-collection.handover' and lang = 'rm';

update public.feature_help set
  purpose = 'Three separate handovers: Company, Vendor, and Party. Each has its own form and slip. The party slip lets staff choose LR 20 or 22.',
  who_uses = 'MCC / milk staff and the manager, for their own branch.',
  when_use = 'When milk goes to the company, a vendor, or a third party. Spoiled milk is only one optional reason.',
  how_steps = array[
    'Open the daily summary: chiller in, out to Company, Vendor, and Party, then the variance. Receipts stay separate.',
    'Company has its own form at LR 20°C. Vendor has its own form at LR 22°C. The chiller grid is the same. SNF, TS and adjusted follow that form''s recipe.',
    'Party has its own form. Pick a party or add a name and contact. Choose 20°C or 22°C — it is not locked. Default is 20°C because good milk can go to a third party too. The slip names the recipe you picked.',
    'Reason is optional: sale, given, spoil, or other. Spoil is not required.',
    'Print, WhatsApp and Email are on every slip. They name the destination and the recipe.',
    'Record each receipt on Milk Dispatch. No receipt means no gap on that slip. No chiller intake means no day variance — do not read either as zero.'
  ],
  mistakes = array[
    'Treating Company and Vendor as one form. One is 20°C and the other is 22°C.',
    'Treating Party as spoiled milk only. Good milk can be sold or given too.',
    'Thinking the party recipe is locked. 20°C is the default and 22°C can be selected. The slip shows which one was used.',
    'Treating 20°C and 22°C as the same chart.',
    'Hiding a destination with no slip. The summary counts that as 0 L out. Missing chiller intake is not zero variance.',
    'Mixing receipts into the three-out variance. Receipts are separate.'
  ],
  next_step = 'Save the slip, then Print, WhatsApp or Email. When a receipt arrives, record it on Milk Dispatch for that slip. The daily summary shows the three outs and the gap.',
  related = array['milk-collection.dispatch','milk-collection.chiller','milk-collection.billing']::text[]
where feature_key = 'milk-collection.handover' and lang = 'en';

update public.feature_help set
  purpose = 'تین الگ حوالگی: کمپنی، وینڈر، پارٹی۔ پارٹی پر نسخہ ۲۰ یا ۲۲ چنا جاتا ہے۔',
  who_uses = 'دودھ کا عملہ اور مینیجر، اپنی شاخ۔',
  when_use = 'جب دودھ کمپنی، وینڈر، یا تیسری پارٹی کو جائے۔ خراب صرف ایک وجہ ہے۔',
  how_steps = array[
    'روز کا خلاصہ: چلر آیا، کمپنی، وینڈر، پارٹی گیا، فرق۔ رسید الگ۔',
    'کمپنی ۲۰ ڈگری۔ وینڈر ۲۲ ڈگری۔ چلر گرڈ ایک جیسا۔',
    'پارٹی پر ۲۰ یا ۲۲ چنیں۔ پہلے سے ۲۰۔ سلپ بتاتی ہے کون سا نسخہ۔',
    'وجہ لازمی نہیں۔ خراب بھی لازمی نہیں۔',
    'پرنٹ، واٹس ایپ، ای میل ہر سلپ پر۔'
  ],
  mistakes = array[
    'کمپنی اور وینڈر کو ایک فارم سمجھنا۔',
    'پارٹی کو صرف خراب دودھ سمجھنا۔',
    'پارٹی کا نسخہ بند سمجھنا۔'
  ],
  next_step = 'سلپ محفوظ کریں، پھر پرنٹ یا واٹس ایپ۔ رسید روانگی پر، اسی سلپ کی۔',
  related = array['milk-collection.dispatch','milk-collection.chiller']::text[]
where feature_key = 'milk-collection.handover' and lang = 'ur';
