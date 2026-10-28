-- 709: TEST sales, vet visits, customer tracking. Testing par. Live par mat chalana.
-- 708 ne har recent is_test bill ko din 1–12 par rakh diya. Aaj ki tareekh khali reh gayi,
-- is liye Total sales Rs 0 / 0 bill, ring chhoti, munafa aur 6-mahine chart galat.
-- Purane counted bills (zyada se zyada 17) aaj Karachi par wapas aate hain. Raqam nahi badalti.
-- TEST-709 bills is mahine ko ~2.6 lakh tak le jati hain (target 4 lakh) aur pichle 5 mahine alag rehte hain.
-- Ledger aur staff-reward functions sirf in receipts par seedha laut ti hain.
-- Payment rows nahi banti, is liye cash-reward trigger chalti hi nahi.
-- Journal delete band hai, is liye agar pehle se claim ho to yahin ruk jata hai.

create or replace function ledger_internal.post_pos_source() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare s pos_sales%rowtype; p record; gl text; fa uuid; lines jsonb:='[]'; claims jsonb; extra numeric; paid numeric:=0; result jsonb; ft uuid; enabled boolean;
begin
  if coalesce(new.receipt_no, '') like 'TEST-709-%' then return new; end if;
  select * into s from pos_sales where id=new.id;
  if s.status<>'completed' or s.dealer_id is not null then return new; end if;
  if exists(select 1 from journal_entry_sources where source_table='pos_sales' and source_row_id=s.id) then return new; end if;
  claims:=jsonb_build_array(jsonb_build_object('table','pos_sales','rowId',s.id));
  select coalesce(value='true',false) into enabled from system_settings where key='wasela_pakistan_enabled';
  for p in select * from pos_sale_payment_details where sale_id=s.id and amount>0 and payment_method<>'khata' order by id loop
    paid:=paid+p.amount;
    select m.finance_account_id,a.gl_code into fa,gl from payment_method_account_map m join finance_accounts a on a.id=m.finance_account_id where m.payment_method=p.payment_method;
    if p.payment_method='waseela_card' and coalesce(enabled,false) then gl:='2062'; end if;
      if gl is null then raise exception 'POS payment account missing: %',p.payment_method; end if;
      select t.id into ft from finance_transactions t where t.account_id=fa and t.category='pos_sale' and t.amount=p.amount and ((t.source_table='pos_sales' and t.source_row_id=s.id) or (t.source_row_id is null and t.created_at=s.created_at)) and not exists(select 1 from journal_entry_sources c where c.source_table='finance_transactions' and c.source_row_id=t.id) and not exists(select 1 from jsonb_array_elements(claims) q where q->>'rowId'=t.id::text) order by (t.source_row_id is null), t.id limit 1;
      if ft is null then raise exception 'POS cash book link missing: %',p.payment_method; end if;
      if exists(select 1 from jsonb_array_elements(claims) c where c->>'rowId'=ft::text) then raise exception 'POS cash book link ambiguous'; end if;
      claims:=claims||jsonb_build_array(jsonb_build_object('table','finance_transactions','rowId',ft));
    lines:=lines||jsonb_build_array(jsonb_build_object('account',gl,'debit',p.amount));
  end loop;
  if s.khata_amount>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account','1100','debit',s.khata_amount,'partyType',case when s.crm_customer_id is not null then 'customer' end,'partyId',s.crm_customer_id)); end if;
  extra:=greatest(0,round(paid+s.khata_amount-s.total_amount,2));
  if extra>0 then
    if s.crm_customer_id is null then raise exception 'POS overpayment requires customer'; end if;
    lines:=lines||jsonb_build_array(jsonb_build_object('account','1100','credit',extra,'partyType','customer','partyId',s.crm_customer_id));
  end if;
  if coalesce(s.discount_amount,0)>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account','4099','debit',s.discount_amount)); end if;
  lines:=lines||jsonb_build_array(jsonb_build_object('account','4000','credit',coalesce(s.gross_amount,s.total_amount)));
  if s.total_cogs>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account','5000','debit',s.total_cogs),jsonb_build_object('account','1200','credit',s.total_cogs)); end if;
  result:=post_journal_atomic(jsonb_build_object('description','POS bikri','sourceModule','pos','posShiftId',s.shift_id,'sourceId',s.id,'branchId',s.branch_id,'createdBy',s.created_by,'lines',lines,'claims',claims));
  if s.crm_customer_id is not null then update customers set current_balance=(select coalesce(sum(debit-credit),0) from journal_lines where account_code='1100' and party_type='customer' and party_id=s.crm_customer_id) where id=s.crm_customer_id; end if;
  return new;
end $$;
revoke all on function ledger_internal.post_pos_source() from public, anon, authenticated;

create or replace function public.fn_staff_sales_reward_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_sale_date date;
  v_daily_total numeric;
  v_reward_id uuid;
  v_staff_name text;
begin
  if coalesce(new.receipt_no, '') like 'TEST-709-%' then return new; end if;
  if new.created_by is null then return new; end if;
  if coalesce(new.status::text, 'completed') in ('cancelled','void','voided','returned','refunded') then return new; end if;

  v_sale_date := (new.created_at at time zone 'Asia/Karachi')::date;
  select full_name into v_staff_name from public.profiles where id = new.created_by;

  select coalesce(sum(total_amount), 0) into v_daily_total
  from public.pos_sales
  where created_by = new.created_by
    and (created_at at time zone 'Asia/Karachi')::date = v_sale_date
    and coalesce(status::text, 'completed') not in ('cancelled','void','voided','returned','refunded');

  for v_rule in
    select threshold_amount, reward_amount, title
    from public.staff_sales_reward_rules
    where is_active = true and threshold_amount <= v_daily_total
    order by threshold_amount
  loop
    insert into public.staff_sales_rewards
      (profile_id, sale_id, sale_date, threshold_amount, reward_amount, title)
    values
      (new.created_by, new.id, v_sale_date, v_rule.threshold_amount, v_rule.reward_amount, v_rule.title)
    on conflict (profile_id, sale_date, threshold_amount) do nothing
    returning id into v_reward_id;

    if v_reward_id is not null then
      insert into public.staff_credit_ledger
        (profile_id, ledger_type, source_type, amount, notes, created_by)
      values
        (new.created_by, 'credit', 'daily_sales_reward', v_rule.reward_amount,
         v_rule.title || ' — ' || coalesce(v_staff_name, 'Staff'), new.created_by);

      insert into public.notifications (recipient_user_id, title, message, link_url)
      values
        (new.created_by,
         'Mubarak! Sales reward hasil ho gaya',
         coalesce(v_staff_name, 'Staff') || ' ne aaj Rs ' || to_char(v_daily_total, 'FM999G999G999') ||
         ' ki sale cross ki. ' || v_rule.title || ': Rs ' || to_char(v_rule.reward_amount, 'FM999G999G999') || ' aapke staff credit mein jama hai.',
         '/admin/my-hr');

      insert into public.notifications (recipient_user_id, title, message, link_url)
      select p.id,
             'Staff achievement: ' || coalesce(v_staff_name, 'Staff'),
             coalesce(v_staff_name, 'Staff') || ' ne aaj ' || v_rule.title || ' hasil kiya — sale Rs ' || to_char(v_daily_total, 'FM999G999G999') || '. Team ko mubarakbad dein!',
             '/admin/hr-dashboard'
      from public.profiles p
      where p.is_active = true
        and p.role::text in ('owner','super_admin','admin','manager','sales_staff','finance','hr');
    end if;
  end loop;
  return new;
end;
$$;

do $clean$
begin
  if exists (
    select 1
    from public.journal_entry_sources j
    join public.pos_sales s on s.id = j.source_row_id
    where j.source_table = 'pos_sales'
      and s.receipt_no like 'TEST-709-%'
  ) then
    raise exception '709: TEST-709 bill par journal hai. Reversal chahiye, delete nahi.';
  end if;
end
$clean$;

delete from public.pos_sale_items
where sale_id in (select id from public.pos_sales where receipt_no like 'TEST-709-%');

delete from public.pos_sale_payment_details
where sale_id in (select id from public.pos_sales where receipt_no like 'TEST-709-%');

delete from public.staff_sales_rewards
where sale_id in (select id from public.pos_sales where receipt_no like 'TEST-709-%');

do $fix$
declare
  karachi_today date := (timezone('Asia/Karachi', now()))::date;
  month_start date := date_trunc('month', karachi_today)::date;
  tpl public.pos_sales%rowtype;
  rec public.pos_sales%rowtype;
  targets numeric[] := array[180000, 210000, 160000, 240000, 140000, 260000];
  back int;
  have numeric;
  gap numeric;
  slots int;
  piece numeric;
  used numeric;
  i int;
  seq int := 0;
  month_day date;
  span int;
begin
  if exists (select 1 from public.pos_sales where receipt_no like 'TEST-709-%') then
    return;
  end if;

  with picked as (
    select id
    from public.pos_sales
    where is_test
      and lower(coalesce(status, 'completed')) not in ('void', 'cancelled')
    order by created_at desc
    limit 17
  ),
  numbered as (
    select id, (row_number() over (order by id) - 1) as rn
    from picked
  )
  update public.pos_sales s
  set created_at = (
    karachi_today
    + interval '8 hours'
    + (n.rn * interval '20 minutes')
  ) at time zone 'Asia/Karachi'
  from numbered n
  where s.id = n.id;

  select * into tpl
  from public.pos_sales
  where is_test
    and total_amount > 0
    and lower(coalesce(status, 'completed')) not in ('void', 'cancelled')
  order by created_at desc
  limit 1;

  if not found then
    raise notice '709: is_test bill nahi, mahine ka clone nahi bana';
    return;
  end if;

  for back in 0..5 loop
    select coalesce(sum(total_amount), 0) into have
    from public.pos_sales
    where is_test
      and lower(coalesce(status, 'completed')) not in ('void', 'cancelled')
      and (created_at at time zone 'Asia/Karachi') >= (month_start - (back * interval '1 month'))
      and (created_at at time zone 'Asia/Karachi') < (month_start - ((back - 1) * interval '1 month'));

    gap := targets[6 - back] - have;
    if gap > 500 then
      slots := least(12, greatest(4, ceil(gap / 12000.0)::int));
      used := 0;
      span := greatest(extract(day from karachi_today)::int - 1, 1);
      for i in 1..slots loop
        if i = slots then
          piece := round(gap - used, 2);
        else
          piece := round((gap / slots) * (88 + (i % 5) * 4) / 100.0, 2);
          if piece > gap - used - (slots - i) then
            piece := round((gap - used) / (slots - i + 1), 2);
          end if;
        end if;
        if piece <= 0 then
          continue;
        end if;
        used := used + piece;
        seq := seq + 1;
        rec := tpl;
        rec.id := gen_random_uuid();
        rec.receipt_no := 'TEST-709-' || lpad(seq::text, 4, '0');
        rec.client_action_id := null;
        rec.is_test := true;
        rec.discount_amount := null;
        rec.discount_reason := null;
        rec.khata_amount := 0;
        rec.cash_paid := piece;
        rec.gross_amount := piece;
        rec.total_amount := piece;
        rec.total_cogs := 0;
        rec.profit := piece;
        if back = 0 then
          month_day := month_start + ((i - 1) % span);
        else
          month_day := (month_start - (back * interval '1 month'))::date + (2 + ((i - 1) % 22));
        end if;
        rec.created_at := (month_day + interval '11 hours' + (i * interval '7 minutes')) at time zone 'Asia/Karachi';
        insert into public.pos_sales select rec.*;
      end loop;
    end if;
  end loop;
end
$fix$;

-- Customer: sab se naya khula Farmer order beech ke step par (Rawana hua, ~50%).
update public.agri_orders
set
  status = 'dispatched',
  notes = btrim(coalesce(notes, '') || ' TEST phone 709')
where id = (
  select id
  from public.agri_orders
  where is_test
    and order_to_type = 'Farmer'
    and status in ('draft', 'submitted', 'approved', 'processing')
    and coalesce(notes, '') not like '%TEST phone 709%'
  order by created_at desc
  limit 1
)
and not exists (
  select 1 from public.agri_orders where notes like '%TEST phone 709%'
);

-- Vet: aaj ki visits ~3. Jo diagnosis aaj pehle se hai, dobara nahi.
insert into public.dairy_health_events (
  farmer_id, kind, diagnosis, medicine, dose, event_date, next_due,
  payment, vet_name, notes, created_by
)
select
  'fa2a6782-2725-49e7-a98c-6b9d2413f281',
  'treatment',
  v.diagnosis,
  v.medicine,
  '10 ml',
  (timezone('Asia/Karachi', now()))::date,
  null,
  'cash',
  'Dr. Nadeem',
  'TEST phone 709',
  '5be05a24-a5c4-4921-9829-315f54b5903d'
from (
  select diagnosis, medicine, row_number() over (order by ord) as rn
  from (
    values
      (1, 'Bukhar', 'Oxytetracycline'),
      (2, 'Thanon ki sozish', 'Ceftiofur'),
      (3, 'Khansi', 'Tylosin')
  ) as want(ord, diagnosis, medicine)
  where not exists (
    select 1
    from public.dairy_health_events h
    where h.farmer_id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281'
      and h.event_date = (timezone('Asia/Karachi', now()))::date
      and h.diagnosis = want.diagnosis
      and not h.voided
  )
) v
where exists (
  select 1 from public.farmers f
  where f.id = 'fa2a6782-2725-49e7-a98c-6b9d2413f281' and f.is_test
)
and v.rn <= (
  select greatest(0, 3 - count(*))
  from public.dairy_health_events h
  where h.event_date = (timezone('Asia/Karachi', now()))::date
    and not h.voided
);
