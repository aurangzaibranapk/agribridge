-- Rollback 592: trigger hatao, 235 wali "for all" policy wapas.
drop trigger if exists trg_staff_details_self_guard on public.staff_details;
drop function if exists public.fn_staff_details_self_guard();
drop policy if exists staff_details_insert_hr on public.staff_details;
drop policy if exists staff_details_update_hr on public.staff_details;
drop policy if exists staff_details_delete_hr on public.staff_details;
drop policy if exists staff_details_write_hr on public.staff_details;
create policy staff_details_write_hr on public.staff_details for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')))
  with check (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')));
