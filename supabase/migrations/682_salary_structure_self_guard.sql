-- 682: S7 tankhwah ka dhancha. Apna structure khud nahi banate, badalte, ya manzoor karte.
-- 551 ka maker-checker update/items par poora nahi tha.

create or replace function public.fn_guard_salary_structure()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'approved' then
      raise exception 'Manzoor shuda structure mitaya nahi ja sakta -- nayi tareekh se naya banayein.';
    end if;
    if auth.uid() is not null and old.profile_id = auth.uid() then
      raise exception 'Apni tankhwah ka structure khud nahi mitaya ja sakta.';
    end if;
    return old;
  end if;
  if auth.uid() is not null and new.profile_id = auth.uid() then
    raise exception 'Apni tankhwah ka structure khud nahi banaya ya badla ja sakta.';
  end if;
  if tg_op = 'INSERT' then
    if new.profile_id = new.created_by then
      raise exception 'Apni tankhwah ka structure khud nahi banaya ja sakta.';
    end if;
    new.status := 'draft';
    new.approved_by := null;
    new.approved_at := null;
    return new;
  end if;
  if old.status <> 'draft' then
    raise exception 'Ye structure % hai -- ab badla nahi ja sakta.', old.status;
  end if;
  if new.created_by <> old.created_by or new.profile_id <> old.profile_id then
    raise exception 'Banane wala / staff badla nahi ja sakta.';
  end if;
  if new.status <> 'draft' and current_setting('agribridge.salary_decide', true) is distinct from 'on' then
    raise exception 'Manzoori sirf fn_salary_structure_decide se.';
  end if;
  return new;
end $$;

create or replace function public.fn_guard_salary_structure_items()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_status text; v_profile uuid;
begin
  select status, profile_id into v_status, v_profile
    from public.staff_salary_structures
   where id = coalesce(new.structure_id, old.structure_id);
  if auth.uid() is not null and v_profile = auth.uid() then
    raise exception 'Apni tankhwah ke hissay khud nahi badle ja sakte.';
  end if;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Manzoor shuda structure ke hissay badle nahi ja sakte.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_guard_salary_structure on public.staff_salary_structures;
create trigger trg_guard_salary_structure
  before insert or update or delete on public.staff_salary_structures
  for each row execute function public.fn_guard_salary_structure();

drop trigger if exists trg_guard_salary_structure_items on public.staff_salary_structure_items;
create trigger trg_guard_salary_structure_items
  before insert or update or delete on public.staff_salary_structure_items
  for each row execute function public.fn_guard_salary_structure_items();

drop policy if exists salary_structures_update on public.staff_salary_structures;
create policy salary_structures_update on public.staff_salary_structures
  for update to authenticated
  using (public.fn_payroll_is_writer() and status = 'draft' and profile_id <> auth.uid())
  with check (public.fn_payroll_is_writer() and profile_id <> auth.uid());

drop policy if exists salary_structure_items_write on public.staff_salary_structure_items;
create policy salary_structure_items_write on public.staff_salary_structure_items
  for all to authenticated
  using (
    public.fn_payroll_is_writer()
    and not exists (
      select 1 from public.staff_salary_structures s
       where s.id = structure_id and s.profile_id = auth.uid()))
  with check (
    public.fn_payroll_is_writer()
    and not exists (
      select 1 from public.staff_salary_structures s
       where s.id = structure_id and s.profile_id = auth.uid()));
