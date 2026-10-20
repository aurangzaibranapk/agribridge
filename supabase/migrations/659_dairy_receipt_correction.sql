-- =====================================================================
-- 659: company ki raseed — Owner theek kare, apni nahi
-- =====================================================================
-- 654 raseed ko ek dafa likhta hai. Ghalat adad phans jata tha.
-- Owner (ya super admin) doosre ki raseed theek kar sakta hai.
-- Jis ne khud likhi, wo nahi. Purani aur nayi miqdar audit mein rehti hai.

create table if not exists public.milk_dispatch_corrections (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null,
  old_received numeric,
  new_received numeric not null,
  corrected_by uuid not null,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.milk_dispatch_corrections enable row level security;
revoke all on public.milk_dispatch_corrections from public, anon, authenticated;

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
      raise exception 'Bheji hui miqdar badli nahi ja sakti';
    end if;
  end if;
  if new.received_liters is not null and new.received_liters > new.dispatched_liters then
    raise exception 'Company bheje se zyada nahi maan sakti';
  end if;
  return new;
end $$;

create or replace function public.fn_correct_milk_receipt(
  p_dispatch uuid,
  p_received numeric,
  p_by uuid,
  p_note text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.milk_dispatches%rowtype;
  v_role text;
begin
  if p_by is null then
    raise exception 'Login zaroori hai.';
  end if;
  if p_note is null or length(btrim(p_note)) < 5 then
    raise exception 'Raseed theek karne ki wajah kam az kam 5 haroof ki likhein.';
  end if;
  if p_received is null or p_received < 0 then
    raise exception 'Company ka adad sahi likhein.';
  end if;

  select role into v_role from public.profiles where id = p_by and is_active;
  if v_role is null or v_role not in ('owner', 'super_admin') then
    raise exception 'Raseed sirf Owner theek kar sakta hai.';
  end if;

  select * into e from public.milk_dispatches where id = p_dispatch for update;
  if not found then
    raise exception 'Rawangi nahi mili.';
  end if;
  if e.received_liters is null then
    raise exception 'Pehle raseed darj karein. Theek karna us ke baad hai.';
  end if;
  if e.received_by is not null and e.received_by = p_by then
    raise exception 'Apni darj ki hui raseed khud theek nahi kar sakte.';
  end if;
  if e.created_by is not null and e.created_by = p_by then
    raise exception 'Apni rawangi ki raseed khud theek nahi kar sakte.';
  end if;
  if p_received > e.dispatched_liters then
    raise exception 'Company bheje se zyada nahi maan sakti.';
  end if;

  insert into public.milk_dispatch_corrections (dispatch_id, old_received, new_received, corrected_by, note)
  values (p_dispatch, e.received_liters, p_received, p_by, left(btrim(p_note), 255));

  perform set_config('agribridge.milk_receipt_correct', 'on', true);
  update public.milk_dispatches
    set received_liters = p_received,
        notes = concat_ws(' | ', notes, 'Raseed theek: ' || left(btrim(p_note), 80))
  where id = p_dispatch;
end $$;

revoke all on function public.fn_correct_milk_receipt(uuid, numeric, uuid, text) from public, anon, authenticated;

do $g$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.fn_correct_milk_receipt(uuid, numeric, uuid, text) to service_role;
  end if;
end
$g$;

comment on function public.fn_correct_milk_receipt(uuid, numeric, uuid, text) is
  'Owner doosre ki company raseed theek kare. Apni nahi. Audit milk_dispatch_corrections (659).';
