-- Paanch nigrani wali views har kisi ko khuli thin.
--
-- 127, 129, 130, 133 aur 135 mein ye views banai gayin, magar un par
-- `security_invoker` nahi lagaya gaya tha. Aisi view apne banane wale ke
-- ikhtiyar se chalti hai, yani base tables ki RLS bilkul lagti hi nahi.
-- Upar se Supabase har nayi view par anon aur authenticated ko select ka
-- haq khud de deta hai.
--
-- Mila kar iska matlab ye tha:
--
--   v_finance_balance_check    cash book ke balance
--   v_inventory_balance_check  godam ka poora stock
--   v_machinery_queue          kisanon ke naam aur MOBILE NUMBER
--   v_pos_returns_today        har wapsi, raqam samet
--   v_milk_dispatch_watch      doodh ki rawangi aur kami
--
-- ...bina login kiye parhi ja sakti thin.
--
-- ---------------------------------------------------------------------
-- Hal: pehra view ke ANDAR
-- ---------------------------------------------------------------------
-- Saada hal `security_invoker = true` lagana tha, magar wo yahan kaam
-- kharab kar deta:
--
--   profiles par sirf `own_profile` ki policy hai. v_pos_returns_today
--   do naam dikhati hai -- bharne wala aur code dene wala -- aur invoker
--   ke sath dono khali aa jate. Yani jis kaam ke liye view banai thi,
--   wohi khatm ho jata.
--
-- Is liye view definer hi rehti hai (taake joins poore rahen), magar
-- pehra khud view ke andar rakh diya gaya hai: fn_is_any_staff(). Staff
-- ko sab kuch pehle jaisa milta hai; baqi sab ko sifar qatarein.
--
-- Sath hi anon se select ka haq wapas le liya gaya -- do taale ek hi
-- darwaze par, kyunke in safhon par jo dikhta hai wo poore karobar ka
-- hisaab hai.

revoke all on public.v_finance_balance_check   from anon;
revoke all on public.v_inventory_balance_check from anon;
revoke all on public.v_machinery_queue         from anon;
revoke all on public.v_pos_returns_today       from anon;
revoke all on public.v_milk_dispatch_watch     from anon;

create or replace view v_finance_balance_check as
select
  a.id as account_id,
  a.name as account_name,
  a.account_type::text as account_type,
  a.opening_balance,
  a.current_balance as yaad_kiya_hua,
  fn_finance_account_true_balance(a.id, a.opening_balance) as asal_hisaab,
  a.current_balance - fn_finance_account_true_balance(a.id, a.opening_balance) as farq
from finance_accounts a
where fn_is_any_staff()
  and a.current_balance <> fn_finance_account_true_balance(a.id, a.opening_balance);

create or replace view v_inventory_balance_check as
select
  i.id as inventory_id,
  p.name as product_name,
  w.name as warehouse_name,
  i.quantity_on_hand as yaad_kiya_hua,
  fn_inventory_true_quantity(i.id) as asal_hisaab,
  i.quantity_on_hand - fn_inventory_true_quantity(i.id) as farq
from inventory i
left join products p on p.id = i.product_id
left join warehouses w on w.id = i.warehouse_id
where fn_is_any_staff()
  and i.quantity_on_hand <> fn_inventory_true_quantity(i.id);

create or replace view v_machinery_queue as
select
  b.id,
  b.booking_number,
  b.status,
  b.booking_date,
  b.preferred_date,
  b.crop_type,
  b.harvest_area,
  b.machine_type_requested,
  b.final_rate,
  b.field_ready,
  b.harvest_ready,
  b.location_address,
  f.full_name as farmer_name,
  f.farmer_code,
  f.phone_number as farmer_phone,
  case
    when b.status = 'new' and b.rate_confirmation_sent_at is null then 'rate_bhejna'
    when b.status = 'new' and b.farmer_confirmed_at is null       then 'tasdeeq_ka_intezar'
    when b.status = 'ready_for_harvest'                            then 'machine_bhejna'
    when b.status = 'in_progress'                                  then 'kaam_darj_karna'
    when b.status = 'bill_pending'                                 then 'bill_banana'
    when b.status = 'payment_pending'                              then 'paisa_lena'
  end as queue,
  (current_date - b.booking_date) as din_purani,
  (b.preferred_date is not null and b.preferred_date < current_date) as tareekh_guzar_gayi
from machinery_bookings b
left join farmers f on f.id = b.farmer_id
-- Wohi do raaste jo machinery_bookings ki apni policy mein hain (115).
where (fn_is_any_staff() or fn_can_machinery('view'))
  and b.status not in ('closed', 'cancelled');

create or replace view v_pos_returns_today as
select
  r.id,
  r.return_number,
  r.created_at,
  r.branch_id,
  b.name as branch_name,
  s.id as sale_id,
  r.reason,
  r.total_amount,
  r.cash_refund,
  r.khata_refund,
  staff.full_name as bhari_kis_ne,
  mgr.full_name as code_kis_ka,
  (r.created_by = r.authorized_by) as manager_ne_khud_ki
from pos_returns r
join pos_sales s on s.id = r.sale_id
left join branches b on b.id = r.branch_id
left join profiles staff on staff.id = r.created_by
left join profiles mgr on mgr.id = r.authorized_by
where fn_is_any_staff();

create or replace view v_milk_dispatch_watch as
select
  d.id,
  d.dispatch_date,
  d.shift,
  b.name as chiller,
  d.dispatched_liters,
  d.received_liters,
  d.shortage_liters,
  d.shortage_percentage,
  case
    when d.received_liters is null then 'raseed_ka_intezar'
    else 'kami_zyada'
  end as issue
from milk_dispatches d
left join branches b on b.id = d.branch_id
cross join (select coalesce(shortage_alert_threshold, 0.5) as t from milk_rate_settings limit 1) s
where fn_is_any_staff()
  and (
    (d.received_liters is null and d.dispatch_date < current_date - 1)
    or (d.received_liters is not null and d.shortage_percentage > s.t)
  );

-- ---------------------------------------------------------------------
-- Haq dobara, haath se -- aur sirf jitna chahiye
-- ---------------------------------------------------------------------
-- Ye qatarein zaroori hain, ehtiyatan nahi. `create or replace view` ke
-- baad in views ke SAARE grants gayab mile -- anon ke bhi, authenticated
-- ke bhi, aur service_role ke bhi. Testing par pehle lagaya to safha
-- "permission denied for view" dene laga; agar ye seedha live par jata
-- to nigrani wale saare safhe band ho jate.
--
-- Is liye ab haath se diya ja raha hai, aur sirf do ko:
--   authenticated -- app ke admin safhe isi ke sath chalte hain
--   service_role  -- roz ki khud-kar jaanch (daily-reconcile)
-- anon ko jaan boojh kar kuch nahi. Pehra view ke andar bhi hai, magar
-- do taale ek hi darwaze par rakhna yahan mehnga nahi.
do $$
declare v text;
begin
  foreach v in array array[
    'v_finance_balance_check', 'v_inventory_balance_check', 'v_machinery_queue',
    'v_pos_returns_today', 'v_milk_dispatch_watch'
  ] loop
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated, service_role', v);
  end loop;
end $$;
