-- =====================================================================
-- AgriBridge — Migration 051: Owner Role (Above Super Admin)
-- =====================================================================
-- Adds "owner" as a new top-level role and updates every RLS policy
-- that currently only allows super_admin/admin, so Owner gets the same
-- full access everywhere without breaking anything already working.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('owner', 'super_admin', 'admin', 'manager', 'sales_staff'));

-- staff_details
drop policy if exists admin_manage_staff_details on staff_details;
create policy admin_manage_staff_details on staff_details for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);

-- attendance_records (admin/manager policy)
drop policy if exists admin_manage_attendance on attendance_records;
create policy admin_manage_attendance on attendance_records for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin','manager'))
);

-- salary_payments
drop policy if exists admin_manage_salary on salary_payments;
create policy admin_manage_salary on salary_payments for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);

-- job_vacancies
drop policy if exists staff_manage_vacancies on job_vacancies;
create policy staff_manage_vacancies on job_vacancies for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);

-- job_applications
drop policy if exists staff_view_applications on job_applications;
create policy staff_view_applications on job_applications for select using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);
drop policy if exists staff_update_applications on job_applications;
create policy staff_update_applications on job_applications for update using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);

-- job_offers
drop policy if exists staff_manage_offers on job_offers;
create policy staff_manage_offers on job_offers for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);

-- interview_scores
drop policy if exists staff_manage_interview_scores on interview_scores;
create policy staff_manage_interview_scores on interview_scores for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true and role in ('owner','super_admin','admin'))
);