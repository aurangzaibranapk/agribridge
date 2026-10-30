-- Mobile TEST blocking fixes. Additive for business data; no existing row is deleted.
-- TEST account rows only. Live rows keep the original SOD, RLS and defaults.

-- Supabase Data API now requires explicit grants as well as RLS.
grant select, insert, update on table public.milk_entries to authenticated;
grant select, insert on table public.milk_dispatches to authenticated;
grant select, insert on table public.staff_advances to authenticated;
grant select, insert on table public.leave_requests to authenticated;
grant execute on function public.fn_my_merchant_orders(text) to authenticated;
grant execute on function public.fn_my_merchant_profile(text) to authenticated;
grant execute on function public.fn_my_merchant_settlements(text) to authenticated;

-- One TEST login previews MCA, MCO and Admin. Self-verification remains forbidden
-- for every live row, but is allowed for is_test milk from the app TEST account.
alter table public.milk_entries drop constraint if exists chk_milk_no_self_verify;
alter table public.milk_entries add constraint chk_milk_no_self_verify check (
  is_test = true
  or verified_by_profile_id is null
  or created_by is null
  or verified_by_profile_id <> created_by
);

create or replace function public.fn_sod_no_self_approval()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  nj jsonb := to_jsonb(new);
  oj jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_creator text;
  v_approver text;
  v_old_approver text;
  v_role text;
begin
  if tg_table_name = 'milk_entries'
     and coalesce((nj ->> 'is_test')::boolean, false)
     and public.fn_is_app_test_account() then
    return new;
  end if;
  for r in select * from sod_transaction_rules where is_active and table_name = tg_table_name loop
    v_creator := nj ->> r.creator_col;
    v_approver := nj ->> r.approver_col;
    v_old_approver := case when oj is null then null else oj ->> r.approver_col end;
    if v_creator is null or v_approver is null then continue; end if;
    if v_approver <> v_creator then continue; end if;
    if v_old_approver is not null and v_old_approver = v_approver then continue; end if;
    select p.role::text into v_role from profiles p where p.id = v_approver::uuid;
    if v_role is not null and v_role = any (r.exempt_roles) then
      insert into sod_transaction_events (rule_id, table_name, record_id, actor_id, event, detail)
      values (r.id, tg_table_name, nj ->> 'id', v_approver::uuid, 'self_approval_exempt',
              jsonb_build_object('role', v_role, 'creator_col', r.creator_col, 'approver_col', r.approver_col, 'label', r.label));
      continue;
    end if;
    if r.enforcement = 'warn' then
      insert into sod_transaction_events (rule_id, table_name, record_id, actor_id, event, detail)
      values (r.id, tg_table_name, nj ->> 'id', v_approver::uuid, 'self_approval_warned',
              jsonb_build_object('role', v_role, 'creator_col', r.creator_col, 'approver_col', r.approver_col, 'label', r.label));
      continue;
    end if;
    raise exception 'SOD: % -- jis ne banaya wohi manzoor/tasdeeq nahi kar sakta. Doosra authorized banda kare. (%: % = %)',
      r.label, tg_table_name, r.approver_col, r.creator_col
      using errcode = 'check_violation';
  end loop;
  return new;
end;
$$;

drop policy if exists milk_entries_test_insert on public.milk_entries;
create policy milk_entries_test_insert on public.milk_entries
  for insert to authenticated
  with check (
    is_test = true
    and public.fn_is_app_test_account()
    and created_by = (select auth.uid())
    and (
      (collection_source = 'mca_field' and mca_profile_id = (select auth.uid()))
      or
      (collection_source = 'self_delivery' and mca_profile_id is null and received_by_profile_id = (select auth.uid()))
    )
    and (
      status = 'pending_fat'
      or (status = 'priced' and fat_percentage is not null and rate_per_liter is not null and total_amount is not null)
    )
    and exists (
      select 1 from public.farmers f
      where f.id = farmer_id and f.is_test and not coalesce(f.is_deleted, false)
    )
  );

-- Dispatches also need TEST isolation; old rows remain live/default false.
alter table public.milk_dispatches add column if not exists is_test boolean not null default false;
create index if not exists milk_dispatches_is_test_idx on public.milk_dispatches (dispatch_date) where is_test;
drop policy if exists milk_dispatch_test_read on public.milk_dispatches;
create policy milk_dispatch_test_read on public.milk_dispatches for select to authenticated
  using (is_test and (select public.fn_is_app_test_account()));
drop policy if exists milk_dispatch_test_insert on public.milk_dispatches;
create policy milk_dispatch_test_insert on public.milk_dispatches for insert to authenticated
  with check (is_test and created_by = (select auth.uid()) and (select public.fn_is_app_test_account()));

-- Keep the source schema in sync with the dealer/supplier roles already used by RPCs.
alter table public.app_test_links drop constraint if exists app_test_links_role_check;
alter table public.app_test_links add constraint app_test_links_role_check check (
  role in ('admin','farmer','customer','mca','mco','vet','staff','dealer','supplier')
);

do $$
declare
  v_uid uuid;
  v_farmer uuid;
  v_customer uuid;
  v_staff uuid;
  v_dealer uuid;
  v_supplier uuid;
  v_branch uuid;
  v_admin uuid;
  v_structure uuid;
  v_basic numeric;
begin
  select u.id into v_uid from auth.users u where lower(u.email) = 'app-test@alranatraders.pk' limit 1;
  if v_uid is null or not coalesce((select p.is_test_account from public.profiles p where p.id=v_uid), false) then
    -- No TEST Auth user on this project: schema fixes stay safe, seed repair is skipped.
    return;
  end if;
  select record_id into v_farmer from public.app_test_links where account_id=v_uid and role='farmer' limit 1;
  select c.id into v_customer from public.customers c
    where c.is_test and (c.user_id=v_uid or c.farmer_id=v_farmer)
    order by (c.user_id=v_uid) desc, c.created_at limit 1;
  select s.id into v_staff from public.staff_details s where s.profile_id=v_uid limit 1;
  select b.id into v_branch from public.branches b where b.is_active order by b.is_main_branch desc,b.created_at limit 1;

  if v_customer is not null then
    insert into public.app_test_links(account_id,role,record_table,record_id,label)
    values(v_uid,'customer','customers',v_customer,'TEST Customer')
    on conflict(account_id,role) do update set record_table='customers',record_id=excluded.record_id,label=excluded.label;
  end if;

  if v_staff is not null then
    update public.staff_details set
      department=coalesce(department,'Karyana / POS'),
      hire_date=coalesce(hire_date,(current_date - interval '1 year')::date),
      branch_id=coalesce(branch_id,v_branch), is_test=true
    where id=v_staff;
  end if;

  select d.id into v_dealer from public.dealers d where d.dealer_code='TEST-DEALER-646' limit 1;
  if v_dealer is null then
    insert into public.dealers(user_id,dealer_code,business_name,contact_person,phone_number,address,current_payable,verification_status,is_active)
    values(v_uid,'TEST-DEALER-646','TEST Dealer Business','TEST App Account','03009990646','TEST database',0,'verified',true)
    returning id into v_dealer;
  else
    update public.dealers set user_id=v_uid,is_active=true where id=v_dealer;
  end if;
  select s.id into v_supplier from public.suppliers s where s.email='test-supplier-646@alranatraders.pk' limit 1;
  if v_supplier is null then
    insert into public.suppliers(user_id,name,company_name,contact_person,phone_number,email,address,current_payable,is_active,status)
    values(v_uid,'TEST Supplier','TEST Supplier Business','TEST App Account','03009990647','test-supplier-646@alranatraders.pk','TEST database',0,true,'active')
    returning id into v_supplier;
  else
    update public.suppliers set user_id=v_uid,is_active=true,status='active' where id=v_supplier;
  end if;
  insert into public.app_test_links(account_id,role,record_table,record_id,label)
  values
    (v_uid,'dealer','dealers',v_dealer,'TEST Dealer'),
    (v_uid,'supplier','suppliers',v_supplier,'TEST Supplier')
  on conflict(account_id,role) do update set record_table=excluded.record_table,record_id=excluded.record_id,label=excluded.label;

  -- Advance eligibility remains real: give the TEST staff a valid joining date and
  -- an approved salary structure based on its existing TEST salary, never a made-up amount.
  if not exists(select 1 from public.staff_salary_structures x where x.profile_id=v_uid and x.status='approved') then
    select p.id into v_admin from public.profiles p
      where p.id<>v_uid and p.is_active and p.role::text in ('owner','super_admin','admin','hr')
      order by case p.role::text when 'owner' then 0 when 'super_admin' then 1 when 'admin' then 2 else 3 end limit 1;
    select sp.net_salary into v_basic from public.salary_payments sp
      where sp.profile_id=v_uid and sp.is_test and sp.net_salary>0
      order by sp.pay_year desc,sp.pay_month desc limit 1;
    if v_admin is not null and v_basic is not null then
      insert into public.staff_salary_structures(profile_id,basic,effective_from,created_by,notes,change_reason)
      values(v_uid,v_basic,(current_date - interval '1 year')::date,v_admin,'TEST app salary eligibility','joining')
      returning id into v_structure;
      perform set_config('agribridge.salary_decide','on',true);
      update public.staff_salary_structures set status='approved',approved_by=v_admin,approved_at=now() where id=v_structure;
      perform set_config('agribridge.salary_decide','off',true);
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
