-- Staff reward policy (Owner decision, 13 Oct 2026):
-- * minimum Rs 30,000 daily RETAIL CASH sales
-- * only invoices paid entirely in cash
-- * wholesale-shop invoices, bank/card/wallet/khata and mixed tenders excluded
-- * Owner/Super Admin/Admin do not receive staff rewards

update public.staff_sales_reward_rules
set is_active = false
where threshold_amount = 10000;

insert into public.staff_sales_reward_rules(threshold_amount, reward_amount, title, is_active)
values (30000, 200, 'Daily Retail Cash Champion — Rs 30,000', true)
on conflict (threshold_amount) do update
set reward_amount=excluded.reward_amount, title=excluded.title, is_active=true;

drop trigger if exists trg_staff_sales_reward_on_sale on public.pos_sales;

create or replace function public.fn_staff_cash_reward_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule record;
  v_sale record;
  v_sale_date date;
  v_daily_cash numeric(14,2);
  v_reward_id uuid;
  v_staff_name text;
  v_staff_role text;
begin
  if lower(coalesce(new.payment_method, '')) <> 'cash' or coalesce(new.amount,0) <= 0 then return new; end if;

  select s.id, s.created_by, s.created_at, s.status, coalesce(s.crm_customer_id, s.customer_id) as customer_id
  into v_sale from public.pos_sales s where s.id = new.sale_id;
  if v_sale.created_by is null or coalesce(v_sale.status::text,'completed') in ('cancelled','void','voided','returned','refunded') then return new; end if;

  select full_name, role::text into v_staff_name, v_staff_role from public.profiles where id=v_sale.created_by and is_active=true;
  if v_staff_role is null or v_staff_role in ('owner','super_admin','admin') then return new; end if;

  -- Mixed payment ko cash sale nahi kehte.
  if exists(select 1 from public.pos_sale_payment_details d where d.sale_id=new.sale_id and d.amount>0 and lower(d.payment_method)<>'cash') then return new; end if;
  -- Registered wholesale shop ki sale reward mein nahi aayegi.
  if exists(select 1 from public.customers c where c.id=v_sale.customer_id and c.customer_type='wholesale_shop') then return new; end if;

  v_sale_date := (v_sale.created_at at time zone 'Asia/Karachi')::date;
  select coalesce(sum(d.amount),0) into v_daily_cash
  from public.pos_sale_payment_details d
  join public.pos_sales s on s.id=d.sale_id
  left join public.customers c on c.id=coalesce(s.crm_customer_id,s.customer_id)
  where s.created_by=v_sale.created_by
    and (s.created_at at time zone 'Asia/Karachi')::date=v_sale_date
    and lower(d.payment_method)='cash' and d.amount>0
    and coalesce(s.status::text,'completed') not in ('cancelled','void','voided','returned','refunded')
    and coalesce(c.customer_type,'retail')<>'wholesale_shop'
    and not exists(select 1 from public.pos_sale_payment_details mix where mix.sale_id=s.id and mix.amount>0 and lower(mix.payment_method)<>'cash');

  if v_daily_cash < 30000 then return new; end if;
  for v_rule in select threshold_amount,reward_amount,title from public.staff_sales_reward_rules
    where is_active=true and threshold_amount>=30000 and threshold_amount<=v_daily_cash order by threshold_amount
  loop
    insert into public.staff_sales_rewards(profile_id,sale_id,sale_date,threshold_amount,reward_amount,title)
    values(v_sale.created_by,new.sale_id,v_sale_date,v_rule.threshold_amount,v_rule.reward_amount,v_rule.title)
    on conflict(profile_id,sale_date,threshold_amount) do nothing returning id into v_reward_id;
    if v_reward_id is not null then
      insert into public.staff_credit_ledger(profile_id,ledger_type,source_type,amount,notes,created_by)
      values(v_sale.created_by,'credit','daily_sales_reward',v_rule.reward_amount,
        v_rule.title || ' — sirf retail cash sale — ' || coalesce(v_staff_name,'Staff'),v_sale.created_by);
      insert into public.notifications(recipient_user_id,title,message,link_url)
      values(v_sale.created_by,'Mubarak! Cash sales reward hasil ho gaya',
        'Aaj ki eligible retail cash sale Rs '||to_char(v_daily_cash,'FM999G999G999')||' hai. '||v_rule.title||': Rs '||to_char(v_rule.reward_amount,'FM999G999G999')||' staff credit mein jama hai.','/admin/my-hr');
      insert into public.notifications(recipient_user_id,title,message,link_url)
      select p.id,'Staff cash achievement: '||coalesce(v_staff_name,'Staff'),
        coalesce(v_staff_name,'Staff')||' ne eligible retail cash sale Rs '||to_char(v_daily_cash,'FM999G999G999')||' par '||v_rule.title||' hasil kiya.','/admin/hr-dashboard'
      from public.profiles p where p.is_active=true and p.role::text in ('owner','super_admin','admin','manager','finance','hr');
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.fn_staff_cash_reward_on_payment() from public, anon;
grant execute on function public.fn_staff_cash_reward_on_payment() to authenticated, service_role;

drop trigger if exists trg_staff_cash_reward_on_payment on public.pos_sale_payment_details;
create trigger trg_staff_cash_reward_on_payment
after insert on public.pos_sale_payment_details
for each row execute function public.fn_staff_cash_reward_on_payment();

comment on function public.fn_staff_cash_reward_on_payment() is
  'Awards active staff rules only after >= Rs 30,000 Pakistan-day retail invoices paid entirely in cash; wholesale and non-cash excluded.';
