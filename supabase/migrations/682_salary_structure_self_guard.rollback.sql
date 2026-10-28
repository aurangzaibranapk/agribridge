-- 682 wapas: 551 wala structure guard.

create or replace function public.fn_guard_salary_structure()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'approved' then raise exception 'Manzoor shuda structure mitaya nahi ja sakta -- nayi tareekh se naya banayein.'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.profile_id = new.created_by then raise exception 'Apni tankhwah ka structure khud nahi banaya ja sakta.'; end if;
    new.status := 'draft'; new.approved_by := null; new.approved_at := null;
    return new;
  end if;
  if old.status <> 'draft' then raise exception 'Ye structure % hai -- ab badla nahi ja sakta.', old.status; end if;
  if new.created_by <> old.created_by or new.profile_id <> old.profile_id then raise exception 'Banane wala / staff badla nahi ja sakta.'; end if;
  if new.status <> 'draft' and current_setting('agribridge.salary_decide', true) is distinct from 'on' then
    raise exception 'Manzoori sirf fn_salary_structure_decide se.';
  end if;
  return new;
end $$;

create or replace function public.fn_guard_salary_structure_items()
returns trigger language plpgsql as $$
declare v_status text;
begin
  select status into v_status from public.staff_salary_structures where id = coalesce(new.structure_id, old.structure_id);
  if v_status is not null and v_status <> 'draft' then raise exception 'Manzoor shuda structure ke hissay badle nahi ja sakte.'; end if;
  return coalesce(new, old);
end $$;

drop policy if exists salary_structures_update on public.staff_salary_structures;
create policy salary_structures_update on public.staff_salary_structures for update to authenticated
  using (public.fn_payroll_is_writer() and status = 'draft') with check (public.fn_payroll_is_writer());
drop policy if exists salary_structure_items_write on public.staff_salary_structure_items;
create policy salary_structure_items_write on public.staff_salary_structure_items for all to authenticated
  using (public.fn_payroll_is_writer()) with check (public.fn_payroll_is_writer());
