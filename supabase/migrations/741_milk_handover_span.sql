-- =====================================================================
-- AgriBridge — Migration 741: Ek slip, kai shifts
-- =====================================================================
-- fn_save_milk_handover_span: wahi parameters jo fn_save_milk_handover ke hain.
-- p_lines ki har qatar mein source_date aur source_shift ho sakte hain. Slip
-- ek hi bante hain (header ki tareekh aur shift shuru wali), aur har line
-- par uski asal tareekh aur shift likhi jati hai. Header ka FAT aur LR poori
-- slip ke lines ka jama hota hai. Purana function nahi badla.
-- Rollback: 741_milk_handover_span.rollback.sql
-- =====================================================================

create or replace function public.fn_save_milk_handover_span(
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
  v_id uuid;
begin
  v_id := public.fn_save_milk_handover(
    p_by, p_id, p_branch_id, p_shop_id, p_date, p_shift, p_collection_time, p_mcc_name,
    p_vehicle, p_driver, p_notes, p_accepted, p_rejection_reason, p_licensee_rep_name,
    p_licensee_signature, p_collector_signature, p_lines, p_destination, p_party_id,
    p_handover_reason, p_lr_baseline
  );

  -- Line number wahi hai jo fn_save_milk_handover ne diya: chiller wali qatar ki ginti.
  with src as (
    select
      row_number() over (order by e.ord) as ln,
      nullif(e.elem->>'source_date', '')::date as sd,
      e.elem->>'source_shift' as ss
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as e(elem, ord)
    where nullif(btrim(coalesce(e.elem->>'chiller_no', '')), '') is not null
  )
  update public.milk_dispatch_lines l
  set source_date = src.sd, source_shift = src.ss
  from src
  where l.dispatch_id = v_id
    and l.line_no = src.ln
    and src.sd is not null
    and src.ss in ('morning', 'evening');

  return v_id;
end $$;

revoke all on function public.fn_save_milk_handover_span(
  uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb, text, uuid, text, integer
) from public, anon, authenticated;

do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_save_milk_handover_span(
      uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb, text, uuid, text, integer
    ) to service_role;
  end if;
end
$g$;
