-- =====================================================================
-- AgriBridge — Migration 235: Staff ki fehrist kis ko nazar aati hai
-- =====================================================================
-- 232 mein hazri ki nayi RLS mein ye likha tha:
--
--     or exists (select 1 from staff_details sd
--                where sd.profile_id = attendance_records.profile_id
--                  and sd.reports_to = auth.uid())
--
-- Ye chalta HI nahi. Wajah: staff_details ki apni RLS sirf
-- owner/super_admin/admin ko parhne deti hai. Manager us subquery se
-- kuch nahi nikal pata -- yani manager ko apni team ki hazri KHALI
-- nazar aati, aur wo khali pan "koi ghair hazir nahi" lagta.
--
-- Yehi wo cheez hai jo is project mein pehle bhi teen dafa ghalat adad
-- de chuki hai: IJAZAT WALI ROK KE PEECHE KHALI JAWAB ko asal adad
-- samajh lena. Is liye pehchan ka har sawal ab SECURITY DEFINER
-- function se poochha jata hai, RLS ke andar se doosre RLS wale table
-- se nahi.
--
-- ---------------------------------------------------------------------
-- Doosri cheez: 'hr' role ko apne hi module mein kuch nazar nahi aata
-- ---------------------------------------------------------------------
-- profiles ki policy fn_is_staff() par thi, aur fn_is_staff sirf 4
-- roles jaanta hai: super_admin, admin, manager, sales_staff. 'hr' us
-- mein hai hi nahi. Yani HR ka banda HR ka safha kholta to usay apne
-- ilawa koi mulazim nazar hi nahi aata tha -- na ghalti, na paighaam,
-- bas khali fehrist.
--
-- fn_is_any_staff() saare andar ke roles jaanta hai. Policy ab us par
-- hai. Ye HR/finance/warehouse waghera ke liye kholna hai -- baahar ke
-- kisi bande ke liye nahi.
--
-- ---------------------------------------------------------------------
-- Teesri cheez: tankhwah har manager ko nazar nahi aani chahiye
-- ---------------------------------------------------------------------
-- staff_details mein basic_salary bhi hai. Is liye us table ko sab ke
-- liye kholna theek nahi. Manager ko team chahiye, tankhwah nahi -- to
-- manager ke liye alag darwaza hai: fn_hr_staff_directory(), jis mein
-- tankhwah ka khana hai hi nahi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) profiles -- andar ka har staff parh sakta hai
-- ---------------------------------------------------------------------
drop policy if exists own_profile on profiles;
create policy own_profile on profiles for select
  using (auth.uid() = id or public.fn_is_any_staff());

-- ---------------------------------------------------------------------
-- 2) staff_details -- parhna aur likhna alag
-- ---------------------------------------------------------------------
drop policy if exists admin_manage_staff_details on staff_details;

-- Apna record har koi dekh sakta hai (apni designation, hire date).
drop policy if exists staff_details_read_own on staff_details;
create policy staff_details_read_own on staff_details for select to authenticated
  using (profile_id = auth.uid());

-- HR/Admin/Owner poori fehrist -- tankhwah samet, kyunke wohi un ka kaam hai.
drop policy if exists staff_details_read_hr on staff_details;
create policy staff_details_read_hr on staff_details for select to authenticated
  using (exists (select 1 from profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')));

drop policy if exists staff_details_write_hr on staff_details;
create policy staff_details_write_hr on staff_details for all to authenticated
  using (exists (select 1 from profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')))
  with check (exists (select 1 from profiles p
                 where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')));

-- ---------------------------------------------------------------------
-- 3) Hazri ki RLS ab SECURITY DEFINER se poochhti hai
-- ---------------------------------------------------------------------
drop policy if exists attendance_read on attendance_records;
create policy attendance_read on attendance_records for select to authenticated
  using (coalesce(public.fn_hr_can_view_staff(profile_id), false));

drop policy if exists attendance_insert on attendance_records;
create policy attendance_insert on attendance_records for insert to authenticated
  with check (
    profile_id = auth.uid()
    or coalesce(public.fn_hr_can_decide_for(profile_id), false)
  );

drop policy if exists attendance_update on attendance_records;
create policy attendance_update on attendance_records for update to authenticated
  using (
    profile_id = auth.uid()
    or coalesce(public.fn_hr_can_decide_for(profile_id), false)
  )
  with check (
    profile_id = auth.uid()
    or coalesce(public.fn_hr_can_decide_for(profile_id), false)
  );

-- Audit aur darkhwast bhi wahi zabaan bolein.
drop policy if exists audit_read on attendance_audit;
create policy audit_read on attendance_audit for select to authenticated
  using (coalesce(public.fn_hr_can_view_staff(profile_id), false));

drop policy if exists corr_read on attendance_corrections;
create policy corr_read on attendance_corrections for select to authenticated
  using (
    coalesce(public.fn_hr_can_view_staff(profile_id), false)
    or manager_id = auth.uid()
  );

drop policy if exists corr_decide on attendance_corrections;
create policy corr_decide on attendance_corrections for update to authenticated
  using (coalesce(public.fn_hr_can_decide_for(profile_id), false));

-- ---------------------------------------------------------------------
-- 4) Staff ki fehrist -- bina tankhwah ke
-- ---------------------------------------------------------------------
create or replace function fn_hr_staff_directory()
returns table (
  profile_id uuid,
  full_name text,
  role text,
  designation text,
  department_key text,
  department_label text,
  branch_id uuid,
  branch_name text,
  employment_type text,
  hire_date date,
  reports_to uuid,
  reports_to_name text,
  direct_reports int
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Ye fehrist sirf staff ke liye hai.';
  end if;

  return query
  select
    pr.id,
    pr.full_name,
    pr.role::text,
    sd.designation,
    sd.department_key,
    d.label,
    coalesce(sd.branch_id, pr.branch_id),
    b.name,
    sd.employment_type,
    sd.hire_date,
    sd.reports_to,
    mgr.full_name,
    (select count(*)::int from staff_details x
      where x.reports_to = pr.id and x.is_active)
  from profiles pr
  join staff_details sd on sd.profile_id = pr.id
  left join departments d on d.key = sd.department_key
  left join branches b on b.id = coalesce(sd.branch_id, pr.branch_id)
  left join profiles mgr on mgr.id = sd.reports_to
  where pr.is_active and sd.is_active
    and coalesce(fn_hr_can_view_staff(pr.id), false)
  order by pr.full_name;
end;
$$;

comment on function fn_hr_staff_directory() is
  'Staff ki fehrist -- tankhwah ka khana yahan JAAN BOOJH KAR nahi hai. Manager ko team chahiye, tankhwah nahi (235).';
comment on policy own_profile on profiles is
  'Andar ka har staff parh sakta hai. Pehle fn_is_staff par thi, jis mein hr/finance/owner shamil hi nahi the (235).';
