-- 683: S8 staff khata (067). Admin apna khata khud nahi likhta.
-- Dihari (check-out) sirf basic/30. Reward functions system flag se guzarti hain,
-- warna HR ki cash reward ki insert ruk jati.

create or replace function public.fn_staff_credit_self_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_basic numeric; v_expect numeric;
begin
  if coalesce(current_setting('agribridge.staff_credit_system', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.profile_id = auth.uid() then
      raise exception 'Apna khata khud nahi mitaya ja sakta.';
    end if;
    return old;
  end if;
  if new.profile_id is distinct from auth.uid() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.ledger_type = 'credit' and new.source_type = 'daily_wage' then
    select basic_salary into v_basic from public.staff_details where profile_id = new.profile_id;
    v_expect := round(coalesce(v_basic, 0) / 30.0, 2);
    if v_basic is null or v_basic <= 0 or abs(new.amount - v_expect) > 0.001 then
      raise exception 'Dihari sirf basic/30 ke barabar khud likhi ja sakti hai.';
    end if;
    return new;
  end if;
  raise exception 'Apna khata khud nahi likha ja sakta.';
end $$;

drop trigger if exists trg_staff_credit_self_guard on public.staff_credit_ledger;
create trigger trg_staff_credit_self_guard
  before insert or update or delete on public.staff_credit_ledger
  for each row execute function public.fn_staff_credit_self_guard();

-- Cash reward (HR/staff) aur reverse: system flag, taake trigger unhein na roke.
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

  if exists(select 1 from public.pos_sale_payment_details d where d.sale_id=new.sale_id and d.amount>0 and lower(d.payment_method)<>'cash') then return new; end if;
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
      perform set_config('agribridge.staff_credit_system', 'on', true);
      insert into public.staff_credit_ledger(profile_id,ledger_type,source_type,amount,notes,created_by)
      values(v_sale.created_by,'credit','daily_sales_reward',v_rule.reward_amount,
        v_rule.title || ' — sirf retail cash sale — ' || coalesce(v_staff_name,'Staff'),v_sale.created_by);
      perform set_config('agribridge.staff_credit_system', 'off', true);
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
end $$;

create or replace function public.fn_staff_sales_reward_reverse_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward record;
  v_staff_name text;
begin
  if old.created_by is null then return new; end if;
  if coalesce(old.status::text, 'completed') in ('cancelled','void','voided','returned','refunded') then return new; end if;
  if coalesce(new.status::text, 'completed') not in ('cancelled','void','voided','returned','refunded') then return new; end if;

  select full_name into v_staff_name from public.profiles where id = old.created_by;
  for v_reward in
    select id, reward_amount, title
    from public.staff_sales_rewards
    where sale_id = old.id and status = 'credited'
  loop
    update public.staff_sales_rewards
    set status = 'reversed', reversed_at = now()
    where id = v_reward.id;

    perform set_config('agribridge.staff_credit_system', 'on', true);
    insert into public.staff_credit_ledger
      (profile_id, ledger_type, source_type, amount, notes, created_by)
    values
      (old.created_by, 'debit', 'sales_reward_reversal', v_reward.reward_amount,
       v_reward.title || ' — sale returned/voided' || coalesce(' — ' || v_staff_name, ''), old.created_by);
    perform set_config('agribridge.staff_credit_system', 'off', true);
  end loop;
  return new;
end $$;
