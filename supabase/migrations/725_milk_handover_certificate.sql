-- =====================================================================
-- 725: Milk Handover Certificate
-- =====================================================================
-- Kaghaz wala "Milk Handover Certificate" ab milk_dispatches ki
-- tafseel hai. Naya silo nahi.
--
--   milk_dispatches      ek branch + tareekh + shift = ek certificate
--                        (ye taala 135 se hai, yahan nahi badla)
--   milk_dispatch_lines  usi rawangi ke chiller: milk type, gross,
--                        FAT, LR, SNF, TS, adjusted, temperature, organo
--
-- TS database khud likhta hai (SNF + FAT). Adjusted volume staff likhe.
-- System litre nahi banata, na purane din bharata hai.
--
-- Min spec (FAT 4.1 / LR 27 / SNF 8.4) sirf nishan hai, rok nahi.
-- Company ki raseed (received_liters) alag rehti hai. Raseed aa jaye
-- to miqdar jam jati hai. Us se pehle certificate ki miqdar
-- fn_save_milk_handover se badal sakti hai — seedhi update se nahi.
--
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 725_milk_handover_certificate.rollback.sql

alter table public.milk_dispatches
  add column if not exists collection_time time,
  add column if not exists mcc_name text,
  add column if not exists shop_id uuid references public.shops(id),
  add column if not exists accepted boolean,
  add column if not exists rejection_reason text,
  add column if not exists licensee_rep_name text,
  add column if not exists licensee_signature text,
  add column if not exists licensee_signed_at timestamptz,
  add column if not exists licensee_signed_by uuid references public.profiles(id),
  add column if not exists collector_signature text,
  add column if not exists collector_signed_at timestamptz,
  add column if not exists collector_signed_by uuid references public.profiles(id);

alter table public.milk_dispatches drop constraint if exists milk_dispatch_reject_reason;
alter table public.milk_dispatches add constraint milk_dispatch_reject_reason check (
  accepted is distinct from false
  or (rejection_reason is not null and char_length(btrim(rejection_reason)) >= 3)
);

comment on column public.milk_dispatches.accepted is
  'Certificate par company ka faisla. NULL = abhi nahi. false par wajah lazmi (725).';
comment on column public.milk_dispatches.mcc_name is
  'Certificate ke header ka MCC naam. Khali ho to save branch/dukaan ka naam likhta hai.';
comment on column public.milk_dispatches.collection_time is
  'Time of Collection. Shift (subah/shaam) alag hai — ek din do certificate ho sakte hain.';

-- Raseed se pehle miqdar sirf certificate save se badle. Seedha update
-- ab bhi band hai. 659 wala raseed-theek karna waisa hi rehta hai.
create or replace function public.fn_milk_dispatch_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if old.received_liters is not null and new.received_liters is distinct from old.received_liters then
      if coalesce(current_setting('agribridge.milk_receipt_correct', true), '') <> 'on' then
        raise exception 'Raseed pehle darj ho chuki hai';
      end if;
    end if;
    if new.dispatched_liters is distinct from old.dispatched_liters then
      if old.received_liters is not null then
        raise exception 'Raseed aa chuki hai — bheji hui miqdar badli nahi ja sakti';
      end if;
      if coalesce(current_setting('agribridge.milk_handover_edit', true), '') <> 'on' then
        raise exception 'Bheji hui miqdar badli nahi ja sakti';
      end if;
    end if;
  end if;
  if new.received_liters is not null and new.received_liters > new.dispatched_liters then
    raise exception 'Company bheje se zyada nahi maan sakti';
  end if;
  return new;
end $$;

create table if not exists public.milk_dispatch_lines (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.milk_dispatches(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  chiller_no text not null,
  milk_type text not null,
  gross_volume_l numeric(14,3) not null check (gross_volume_l >= 0),
  fat_percentage numeric(5,2),
  lr numeric(6,2),
  snf_percentage numeric(5,2),
  ts_percentage numeric(6,2) generated always as (
    case
      when fat_percentage is null or snf_percentage is null then null
      else round(fat_percentage + snf_percentage, 2)
    end
  ) stored,
  adjusted_volume_l numeric(14,3),
  temperature_c numeric(5,2),
  organo text,
  created_at timestamptz not null default now(),
  constraint milk_dispatch_lines_one_no unique (dispatch_id, line_no),
  constraint milk_dispatch_lines_chiller check (char_length(btrim(chiller_no)) between 1 and 40),
  constraint milk_dispatch_lines_type check (char_length(btrim(milk_type)) between 1 and 40),
  constraint milk_dispatch_lines_fat check (fat_percentage is null or (fat_percentage > 0 and fat_percentage <= 20)),
  constraint milk_dispatch_lines_lr check (lr is null or (lr > 0 and lr <= 60)),
  constraint milk_dispatch_lines_snf check (snf_percentage is null or (snf_percentage > 0 and snf_percentage <= 20)),
  constraint milk_dispatch_lines_adjusted check (
    adjusted_volume_l is null or (adjusted_volume_l >= 0 and adjusted_volume_l <= 100000)
  ),
  constraint milk_dispatch_lines_temp check (
    temperature_c is null or (temperature_c >= -5 and temperature_c <= 60)
  ),
  constraint milk_dispatch_lines_organo check (organo is null or char_length(organo) <= 40)
);

create index if not exists idx_milk_dispatch_lines_dispatch
  on public.milk_dispatch_lines (dispatch_id, line_no);

comment on table public.milk_dispatch_lines is
  'Certificate ki chiller qatarein. TS = SNF+FAT. Adjusted volume staff ka adad hai, generate nahi (725).';

alter table public.milk_dispatch_lines enable row level security;
drop policy if exists milk_dispatch_lines_select on public.milk_dispatch_lines;
create policy milk_dispatch_lines_select on public.milk_dispatch_lines
  for select to authenticated
  using (public.fn_is_any_staff());

revoke all on public.milk_dispatch_lines from public, anon, authenticated;
grant select on public.milk_dispatch_lines to authenticated;

-- Kaghaz par chhapa hua minimum. Litre nahi. Owner badal sakta hai;
-- khali rehne par safha yahi 4.1 / 27 / 8.4 dikhata hai.
create table if not exists public.milk_handover_specs (
  id boolean primary key default true check (id),
  min_fat numeric(5,2) not null default 4.1,
  min_lr numeric(6,2) not null default 27,
  min_snf numeric(5,2) not null default 8.4,
  updated_at timestamptz not null default now()
);

insert into public.milk_handover_specs (id, min_fat, min_lr, min_snf)
values (true, 4.1, 27, 8.4)
on conflict (id) do nothing;

alter table public.milk_handover_specs enable row level security;
drop policy if exists milk_handover_specs_select on public.milk_handover_specs;
create policy milk_handover_specs_select on public.milk_handover_specs
  for select to authenticated
  using (public.fn_is_any_staff());

revoke all on public.milk_handover_specs from public, anon, authenticated;
grant select on public.milk_handover_specs to authenticated;

comment on table public.milk_handover_specs is
  'Certificate ke Min Specs. Default FAT 4.1, LR 27, SNF 8.4. Neeche hone par warn, save rukta nahi (725).';

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
  p_lines jsonb
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

  if p_id is not null then
    select * into e from public.milk_dispatches where id = p_id for update;
    if not found then
      raise exception 'Ye certificate nahi mila.';
    end if;
    if v_role in ('manager', 'milk_collection') and v_home is not null and e.branch_id is distinct from v_home then
      raise exception 'Ye aapki branch ki rawangi nahi.';
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

  if exists (
    select 1 from public.milk_dispatches d
    where d.branch_id = p_branch_id
      and d.dispatch_date = p_date
      and d.shift = v_shift
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
      created_by
    ) values (
      p_branch_id, p_shop_id, p_date, v_shift, p_collection_time, v_mcc,
      v_sum, v_header_fat, v_header_snf,
      v_vehicle, v_driver, v_notes,
      p_accepted, v_reason, v_rep,
      v_lic, case when v_lic is null then null else now() end, case when v_lic is null then null else p_by end,
      v_col, case when v_col is null then null else now() end, case when v_col is null then null else p_by end,
      p_by
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
      end
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
  uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb
) from public, anon, authenticated;

do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_save_milk_handover(
      uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb
    ) to service_role;
    grant select, insert, update, delete on public.milk_dispatch_lines to service_role;
    grant select on public.milk_handover_specs to service_role;
  end if;
end
$g$;

comment on function public.fn_save_milk_handover(
  uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb
) is
  'Milk Handover Certificate. Gross ka jama dispatched_liters. Adjusted khud nahi banta. Raseed ke baad sirf faisla aur dastakhat (725).';

insert into public.features (
  key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active
) values (
  'milk-collection.handover',
  'Milk Handover Certificate',
  'Milk Handover Certificate',
  'دودھ حوالگی سرٹیفکیٹ',
  'MCC se company ko roz ka certificate: chiller ki qatarein, FAT, LR, SNF, qubool ya radd.',
  'Daily MCC to company certificate: chiller lines, FAT, LR, SNF, accept or reject.',
  'ایم سی سی سے کمپنی کو روز کا سرٹیفکیٹ: چلر کی قطاریں، فیٹ، ایل آر، ایس این ایف، قبول یا رد۔',
  '/admin/milk-collection/handover',
  'FileCheck',
  false,
  true
)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  label_ur = excluded.label_ur,
  description = excluded.description,
  description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  route = excluded.route,
  icon = excluded.icon,
  is_sensitive = excluded.is_sensitive,
  is_active = true;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('owner', 'milk-collection.handover', array['view','create','edit']::text[], 'all'),
  ('super_admin', 'milk-collection.handover', array['view','create','edit']::text[], 'all'),
  ('admin', 'milk-collection.handover', array['view','create','edit']::text[], 'all'),
  ('manager', 'milk-collection.handover', array['view','create','edit']::text[], 'own_branch'),
  ('milk_collection', 'milk-collection.handover', array['view','create','edit']::text[], 'own_branch')
on conflict (role, feature_key) do update set
  actions = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, section, section_order, sort_order)
select 'milk', 'milk-collection.handover', 'Dairy', 3, 26
where exists (select 1 from public.dashboards where key = 'milk')
on conflict (dashboard_key, feature_key) do update set
  section = excluded.section,
  section_order = excluded.section_order,
  sort_order = excluded.sort_order;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, related)
values
('milk-collection.handover', 'rm',
 'MCC se company ko doodh ka roz ka handover certificate. Wahi rawangi (milk dispatch), ab chiller ki alag qatarein ke sath: miqdar, FAT, LR, SNF, temperature, organo, aur qubool ya radd.',
 'MCC / doodh ka staff aur manager. Apni branch.',
 'Har shift jab doodh company ko jata hai. Purani tareekh (jaise 26 October) baad mein khud bhari ja sakti hai — system litre nahi banata.',
 array[
   'Milk Handover Certificate kholen. Branch, tareekh, shift (subah/shaam) aur MCC naam.',
   'Har chiller ki qatar: number, milk type, gross litre, FAT, LR, SNF. TS khud (SNF+FAT). Adjusted volume khud likhein — khali chhorna theek hai.',
   'Min spec se neeche ho to peela nishan. Save rukta nahi. Company phir bhi qubool kar sakti hai.',
   'Accepted YES ya NO. NO par wajah lazmi. Licensee aur collector ka naam dastakhat ke taur par.',
   'Print se kaghaz jaisa safha. Company ki raseed (kitne litre mane) Rawangi wale safhe par, jab aa jaye.'
 ],
 'Raseed aa jaye to Doodh ki Rawangi par company ka litre likhein. Us ke baad certificate ki miqdar nahi badalti; faisla aur dastakhat ab bhi.',
 array[
   'Khali chiller ki miqdar 0 likh dena jab doodh gaya hi nahi — kam az kam ek asal miqdar chahiye.',
   'Adjusted volume khali chhor kar ye samajhna ke system ne bana diya. Andaza tabhi likha jata hai jab aap Likhein dabayein.',
   'Min spec se neeche ko rok samajhna. Wo nishan hai, mana nahi.',
   'Do shift ko ek certificate mein mila dena. Subah aur shaam alag hain.',
   'Raseed (company ne kitna mana) ko certificate ke Adjusted Volume se khud barabar samajhna. Dono alag hain.'
 ],
 array['milk-collection.dispatch','milk-collection.chiller','milk-collection.billing']::text[]),
('milk-collection.handover', 'en',
 'Daily MCC to company milk handover certificate. Same dispatch record, with one row per chiller: volume, FAT, LR, SNF, temperature, organo, and accept or reject.',
 'MCC / milk staff and the manager, for their own branch.',
 'Each shift when milk goes to the company. Older dates can be filled later. The system does not invent litres.',
 array[
   'Open Milk Handover Certificate. Choose branch, date, shift and MCC name.',
   'Each chiller row: number, milk type, gross litres, FAT, LR, SNF. TS is SNF+FAT. Type adjusted volume yourself — blank is allowed.',
   'Below the minimum spec is a warning, not a block.',
   'Accepted YES or NO. NO needs a reason. Licensee and collector names are the signatures.',
   'Print for the paper layout. Company receipt litres stay on Milk Dispatch, when they arrive.'
 ],
 'When the company receipt arrives, record it on Milk Dispatch. After that, certificate litres freeze. The decision and signatures can still be saved.',
 array[
   'Typing 0 for a chiller that sent no milk, and leaving the certificate with no real volume.',
   'Leaving adjusted volume blank and assuming the system filled it.',
   'Treating a minimum-spec warning as a hard stop.',
   'Putting morning and evening on one certificate.',
   'Treating adjusted volume as the company receipt. They are different numbers.'
 ],
 array['milk-collection.dispatch','milk-collection.chiller','milk-collection.billing']::text[]),
('milk-collection.handover', 'ur',
 'ایم سی سی سے کمپنی کو دودھ کا روزانہ حوالگی سرٹیفکیٹ۔ وہی روانگی، چلر کی الگ قطاریں۔',
 'دودھ کا عملہ اور مینیجر، اپنی شاخ۔',
 'ہر شفٹ جب دودھ کمپنی کو جائے۔ پرانی تاریخ بعد میں۔ سسٹم لیٹر نہیں بناتا۔',
 array[
   'سرٹیفکیٹ کھولیں۔ شاخ، تاریخ، شفٹ اور ایم سی سی۔',
   'ہر چلر: نمبر، دودھ کی قسم، گراس لیٹر، فیٹ، ایل آر، ایس این ایف۔ ٹی ایس خود۔ ایڈجسٹڈ لیٹر خود لکھیں۔',
   'کم از کم معیار سے نیچے پیلے نشان۔ محفوظ رکتا نہیں۔',
   'قبول ہاں یا نہیں۔ نہیں پر وجہ لازمی۔ نام دستخط ہیں۔',
   'پرنٹ۔ کمپنی کی رسید روانگی والے صفحے پر۔'
 ],
 'رسید آئے تو روانگی پر کمپنی کا لیٹر لکھیں۔ اس کے بعد مقدار نہیں بدلتی۔',
 array[
   'خالی سرٹیفکیٹ محفوظ کرنا۔',
   'ایڈجسٹڈ لیٹر کو خود بخود سمجھنا۔',
   'وارننگ کو پابندی سمجھنا۔'
 ],
 array['milk-collection.dispatch','milk-collection.chiller']::text[])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  related = excluded.related;

update public.feature_help set
  how_steps = array[
    'Milk Handover Certificate kholen — chiller ki qatarein wahan hoti hain.',
    'Sirf litre ki rawangi yahan bhi darj ho sakti hai.',
    'Company ki raseed aane par yahan litre likhein.'
  ],
  next_step = 'Poora certificate Milk Handover Certificate par. Raseed (company ne kitne litre mane) yahin, jab aa jaye.'
where feature_key = 'milk-collection.dispatch' and lang = 'rm';

update public.role_page_permissions
set allowed_pages = (
  select array(
    select distinct x
    from unnest(
      coalesce(allowed_pages, '{}'::text[])
      || array['/admin/milk-collection/handover']::text[]
    ) as x
  )
)
where role in ('milk_collection', 'manager');
