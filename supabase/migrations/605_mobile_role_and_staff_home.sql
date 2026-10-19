-- =====================================================================
-- 605: Mobile app -- role pehchan + Sales staff home (sirf parhna).
--   fn_mobile_whoami()             -> login kaun hai: staff/farmer/customer/none
--   fn_staff_can_see_branch(uuid)  -> 596 wala branch qaida
--   fn_staff_home_summary(date)    -> aaj ki sale, recovery, baqaya, wade, pending
--   fn_staff_party_search(...)     -> parties + baqaya (phone masked)
--   fn_staff_party_view(uuid)      -> ek party ka header + khata/bills/wade
-- Branch qaida (596 jaisa): owner/super_admin/admin/admin_assistant/finance
--   -> sab branches; baqi staff -> sirf apni branch; branch khali -> kuch nahi;
--   farmer/customer/anon -> error.
-- Har staff call mobile_staff_action_log mein likhi jati hai (kaun, kya, party).
-- Additive: koi purana table/function nahi badla. Dobara chalana mehfooz.
-- Wapas: supabase/rollbacks/605_mobile_role_and_staff_home.down.sql
-- =====================================================================

create table if not exists public.mobile_staff_action_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  party_id uuid,
  branch_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mobile_staff_action_log_actor_idx on public.mobile_staff_action_log (actor_id, created_at desc);
alter table public.mobile_staff_action_log enable row level security;
revoke all on public.mobile_staff_action_log from anon, authenticated;
drop policy if exists mobile_staff_action_log_admin_read on public.mobile_staff_action_log;
create policy mobile_staff_action_log_admin_read on public.mobile_staff_action_log
  for select to authenticated
  using (public.fn_has_dept(array['owner','super_admin','admin']::public.user_role[]));
grant select on public.mobile_staff_action_log to authenticated;

create or replace function public.fn_mobile_mask_phone(p text)
returns text language sql immutable set search_path = public as $$
  select case when p is null or length(regexp_replace(p,'\D','','g')) < 6 then p
    else left(regexp_replace(p,'\D','','g'), 4) || repeat('x', greatest(length(regexp_replace(p,'\D','','g')) - 6, 0)) || right(regexp_replace(p,'\D','','g'), 2) end
$$;

create or replace function public.fn_mobile_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active
                 and role not in ('farmer','customer'))
$$;

create or replace function public.fn_staff_sees_all_branches()
returns boolean language sql stable security definer set search_path = public as $$
  select public.fn_has_dept(array['owner','super_admin','admin','admin_assistant','finance']::public.user_role[])
$$;

create or replace function public.fn_staff_can_see_branch(p_branch uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.fn_mobile_is_staff() and (
    public.fn_staff_sees_all_branches()
    or (p_branch is not null and p_branch = (select branch_id from profiles where id = auth.uid()))
  )
$$;

create or replace function public.fn_mobile_log(p_action text, p_party uuid, p_branch uuid, p_details jsonb)
returns void language sql volatile security definer set search_path = public as $$
  insert into mobile_staff_action_log (actor_id, action, party_id, branch_id, details)
  values (auth.uid(), p_action, p_party, p_branch, coalesce(p_details, '{}'::jsonb))
$$;
revoke all on function public.fn_mobile_log(text, uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.fn_mobile_whoami()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p record; v_farmer uuid; v_customer uuid; v_kind text;
begin
  if auth.uid() is null then return jsonb_build_object('kind','none'); end if;
  select id, full_name, role::text as role, branch_id into p from profiles where id = auth.uid() and is_active;
  if not found then return jsonb_build_object('kind','none'); end if;
  select id into v_farmer from farmers where user_id = auth.uid() and coalesce(is_deleted,false) = false limit 1;
  select id into v_customer from customers where user_id = auth.uid() and coalesce(is_deleted,false) = false limit 1;
  v_kind := case when p.role not in ('farmer','customer') then 'staff'
                 when v_farmer is not null or p.role = 'farmer' then 'farmer'
                 else 'customer' end;
  return jsonb_build_object(
    'kind', v_kind, 'role', p.role, 'name', coalesce(p.full_name, 'User'),
    'branch_id', p.branch_id, 'farmer_id', v_farmer, 'customer_id', v_customer,
    'sees_all_branches', v_kind = 'staff' and public.fn_staff_sees_all_branches());
end $$;

-- party ka baqaya: journal 1100 (debit - credit)
create or replace function public.fn_mobile_party_balance(p_party uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(coalesce(debit,0) - coalesce(credit,0)), 0)
    from journal_lines where party_type = 'customer' and party_id = p_party and account_code = '1100'
$$;
revoke all on function public.fn_mobile_party_balance(uuid) from public, anon, authenticated;

create or replace function public.fn_staff_home_summary(p_date date default current_date)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb; v_pending int := 0;
begin
  if auth.uid() is null or not public.fn_mobile_is_staff() then raise exception 'Sirf staff ke liye.'; end if;
  -- 606 lagne ke baad: pending app entries (apni branch ki)
  if to_regclass('public.mobile_staff_entries') is not null then
    execute 'select count(*) from public.mobile_staff_entries where status = ''pending'' and public.fn_staff_can_see_branch(branch_id)' into v_pending;
  end if;
  with c as (select id, branch_id from customers where coalesce(is_deleted,false) = false and public.fn_staff_can_see_branch(branch_id)),
  bal as (select c.id, public.fn_mobile_party_balance(c.id) as due from c)
  select jsonb_build_object(
    'date', p_date,
    'sales_today', (select coalesce(sum(total_amount),0) from pos_sales s where s.created_at::date = p_date and coalesce(s.status,'completed') <> 'voided'
                     and public.fn_staff_can_see_branch(s.branch_id)),
    'bills_today', (select count(*) from pos_sales s where s.created_at::date = p_date and coalesce(s.status,'completed') <> 'voided'
                     and public.fn_staff_can_see_branch(s.branch_id)),
    'recovery_today', (select coalesce(sum(l.credit),0) from journal_lines l join journal_entries e on e.id = l.entry_id join c on c.id = l.party_id
                        where l.party_type = 'customer' and l.account_code = '1100' and e.entry_date = p_date and e.source_module in ('recovery_money','recovery','customer_udhaar')),
    'branch_due', (select coalesce(sum(due) filter (where due > 0),0) from bal),
    'parties_due', (select count(*) filter (where due > 0) from bal),
    'promises_today', (select count(*) from payment_promises pp join c on c.id = pp.party_id where pp.party_type = 'customer' and pp.status = 'open' and pp.promise_date <= p_date),
    'promises_today_amount', (select coalesce(sum(pp.promised_amount - coalesce(pp.fulfilled_amount,0)),0) from payment_promises pp join c on c.id = pp.party_id where pp.party_type = 'customer' and pp.status = 'open' and pp.promise_date <= p_date),
    'pending_orders', (select count(*) from agri_orders o join c on c.id = o.customer_id where o.status = 'pending'),
    'pending_entries', v_pending
  ) into v;
  perform public.fn_mobile_log('home_summary', null, null, jsonb_build_object('date', p_date));
  return v;
end $$;

create or replace function public.fn_staff_party_search(
  p_q text default null, p_kind text default 'all', p_min_age_days int default null,
  p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb; v_q text := nullif(trim(coalesce(p_q,'')), '');
begin
  if auth.uid() is null or not public.fn_mobile_is_staff() then raise exception 'Sirf staff ke liye.'; end if;
  if p_kind not in ('all','farmer','customer') then raise exception 'kind ghalat'; end if;
  with c as (
    select cu.id, cu.name, cu.phone_number, cu.branch_id, cu.farmer_id,
           case when cu.farmer_id is not null then 'farmer' else 'customer' end as kind,
           coalesce(f.farmer_code, 'CUS-' || left(cu.id::text, 6)) as code
      from customers cu left join farmers f on f.id = cu.farmer_id
     where coalesce(cu.is_deleted,false) = false and public.fn_staff_can_see_branch(cu.branch_id)
       and (p_kind = 'all' or (p_kind = 'farmer') = (cu.farmer_id is not null))
       and (v_q is null or cu.name ilike '%' || v_q || '%' or f.farmer_code ilike '%' || v_q || '%'
            or regexp_replace(coalesce(cu.phone_number,''),'\D','','g') like '%' || regexp_replace(v_q,'\D','','g') || '%' and length(regexp_replace(v_q,'\D','','g')) >= 4)
  ), r as (
    select c.*, public.fn_mobile_party_balance(c.id) as due,
      -- FIFO: sab se purana bill jo abhi poora wapas nahi hua
      (select current_date - min(d.entry_date) from (
         select e.entry_date, sum(l.debit) over (order by e.entry_date, l.id) as run
           from journal_lines l join journal_entries e on e.id = l.entry_id
          where l.party_type = 'customer' and l.party_id = c.id and l.account_code = '1100' and l.debit > 0) d
        where d.run > (select coalesce(sum(credit),0) from journal_lines
                        where party_type = 'customer' and party_id = c.id and account_code = '1100')) as age_days,
      (select min(pp.promise_date) from payment_promises pp where pp.party_type = 'customer' and pp.party_id = c.id and pp.status = 'open') as next_promise
    from c
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'kind', kind, 'code', code,
           'phone_masked', public.fn_mobile_mask_phone(phone_number), 'due', due, 'age_days', age_days, 'next_promise', next_promise)
           order by due desc, name), '[]'::jsonb)
    into v
    from (select * from r where p_min_age_days is null or coalesce(age_days,0) >= p_min_age_days
          order by due desc, name limit least(greatest(p_limit,1),200) offset greatest(p_offset,0)) x;
  perform public.fn_mobile_log('party_search', null, null, jsonb_build_object('q', v_q, 'kind', p_kind));
  return v;
end $$;

create or replace function public.fn_staff_party_view(p_party uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare cu record; v jsonb;
begin
  if auth.uid() is null or not public.fn_mobile_is_staff() then raise exception 'Sirf staff ke liye.'; end if;
  select c.*, f.farmer_code into cu from customers c left join farmers f on f.id = c.farmer_id
   where c.id = p_party and coalesce(c.is_deleted,false) = false;
  if not found or not public.fn_staff_can_see_branch(cu.branch_id) then raise exception 'Party nahi mili ya aap ki branch ki nahi.'; end if;
  v := jsonb_build_object(
    'id', cu.id, 'name', cu.name, 'kind', case when cu.farmer_id is not null then 'farmer' else 'customer' end,
    'code', coalesce(cu.farmer_code, 'CUS-' || left(cu.id::text, 6)),
    'phone', cu.phone_number, 'branch_id', cu.branch_id, 'credit_limit', cu.credit_limit,
    'due', public.fn_mobile_party_balance(cu.id),
    'khata', coalesce((select jsonb_agg(x order by x->>'date' desc) from (
        select jsonb_build_object('date', e.entry_date, 'ref', e.entry_number, 'source', e.source_module,
               'debit', l.debit, 'credit', l.credit) as x
          from journal_lines l join journal_entries e on e.id = l.entry_id
         where l.party_type = 'customer' and l.party_id = cu.id and l.account_code = '1100'
         order by e.entry_date desc, e.created_at desc limit 30) k), '[]'::jsonb),
    'promises', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'amount', promised_amount, 'date', promise_date, 'status', status) order by promise_date)
         from payment_promises where party_type = 'customer' and party_id = cu.id and status = 'open'), '[]'::jsonb));
  perform public.fn_mobile_log('party_view', cu.id, cu.branch_id, '{}'::jsonb);
  return v;
end $$;

-- sirf login waale; anon/public nahi
revoke all on function public.fn_mobile_whoami() from public, anon;
revoke all on function public.fn_staff_home_summary(date) from public, anon;
revoke all on function public.fn_staff_party_search(text, text, int, int, int) from public, anon;
revoke all on function public.fn_staff_party_view(uuid) from public, anon;
grant execute on function public.fn_mobile_whoami() to authenticated;
grant execute on function public.fn_staff_home_summary(date) to authenticated;
grant execute on function public.fn_staff_party_search(text, text, int, int, int) to authenticated;
grant execute on function public.fn_staff_party_view(uuid) to authenticated;
grant execute on function public.fn_staff_can_see_branch(uuid) to authenticated;

notify pgrst, 'reload schema';
