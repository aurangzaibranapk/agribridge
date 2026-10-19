-- =====================================================================
-- AgriBridge — Migration 592: Apni tankhwah / joining / afsar khud nahi (S4)
-- =====================================================================
-- HR audit (S4): staff_details_write_hr (235) HR/Admin/Owner ko poori
-- staff_details par likhne deti hai -- APNI qatar samet. Yani HR apni
-- basic_salary, hire_date (jis se chhutti/advance ki ahliyat banti hai)
-- ya reports_to (jo us ki chhutti/hazri manzoor karta hai) khud badal
-- sakta tha. App mein saveStaffDetails par rok thi, magar
-- saveReportingLine / startProbation par nahi, aur API se seedha raasta
-- khula tha.
--
-- Ab: apni qatar par ye khaane koi khud nahi badal sakta -- chahe HR ho,
-- Admin ya Owner:
--   basic_salary, hire_date, reports_to, employment_status,
--   probation_start_date, probation_end_date, confirmed_at, confirmed_by
-- Apni qatar mita kar dobara banana bhi band (wo isi rok ka chor
-- darwaza tha). Baqi khaane (photo, blood group, emergency contact)
-- pehle ki tarah.
-- Server (service role, auth.uid() null) par ye rok nahi -- naye staff
-- ka invite wahi se hota hai.
-- Additive. Rollback: supabase/rollbacks/592_*.sql
-- =====================================================================

create or replace function public.fn_staff_details_self_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid;
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.profile_id = v_actor then
      raise exception 'Apna staff record khud nahi mitaya ja sakta.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.profile_id = v_actor
       and (new.basic_salary is not null or new.hire_date is not null or new.reports_to is not null
            or new.probation_start_date is not null or new.probation_end_date is not null
            or new.confirmed_at is not null or new.confirmed_by is not null) then
      raise exception 'Apni tankhwah, joining date ya afsar khud nahi likhe ja sakte. Ye kaam doosra HR/Admin karega.';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.profile_id = v_actor or old.profile_id = v_actor then
    if new.profile_id is distinct from old.profile_id then
      raise exception 'Staff record kisi aur ke naam nahi kiya ja sakta.';
    end if;
    if new.basic_salary is distinct from old.basic_salary then
      raise exception 'Apni tankhwah khud nahi badli ja sakti.';
    end if;
    if new.hire_date is distinct from old.hire_date then
      raise exception 'Apni joining date khud nahi badli ja sakti.';
    end if;
    if new.reports_to is distinct from old.reports_to then
      raise exception 'Apna afsar (reporting) khud nahi badla ja sakta.';
    end if;
    if new.employment_status is distinct from old.employment_status
       or new.probation_start_date is distinct from old.probation_start_date
       or new.probation_end_date is distinct from old.probation_end_date
       or new.confirmed_at is distinct from old.confirmed_at
       or new.confirmed_by is distinct from old.confirmed_by then
      raise exception 'Apni aazmaishi muddat ya pakki naukri ka faisla khud nahi ho sakta.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_staff_details_self_guard() from public, anon;
grant execute on function public.fn_staff_details_self_guard() to authenticated, service_role;

drop trigger if exists trg_staff_details_self_guard on public.staff_details;
create trigger trg_staff_details_self_guard
  before insert or update or delete on public.staff_details
  for each row execute function public.fn_staff_details_self_guard();

-- RLS: "for all" policy ko teen hisson mein -- taake apni qatar ko MITANA
-- policy hi se band ho. Insert/update apni qatar par rehte hain (photo,
-- blood group waghera), hassas khaane upar wala trigger rokta hai.
drop policy if exists staff_details_write_hr on public.staff_details;
drop policy if exists staff_details_insert_hr on public.staff_details;
create policy staff_details_insert_hr on public.staff_details for insert to authenticated
  with check (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')));
drop policy if exists staff_details_update_hr on public.staff_details;
create policy staff_details_update_hr on public.staff_details for update to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')))
  with check (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')));
drop policy if exists staff_details_delete_hr on public.staff_details;
create policy staff_details_delete_hr on public.staff_details for delete to authenticated
  using (profile_id <> auth.uid()
         and exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')));

comment on function public.fn_staff_details_self_guard() is
  'Apni tankhwah/joining/afsar/aazmaish khud nahi badalti -- HR/Admin/Owner bhi nahi (592).';
