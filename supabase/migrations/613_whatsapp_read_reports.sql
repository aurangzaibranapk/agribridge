-- 613: WhatsApp = App, Phase 1 -- read-only jawab. ADDITIVE ONLY. NOT applied.
--
-- * Sirf parhna. Koi insert / update / delete nahi.
-- * Webhook service_role se chalta hai (auth.uid() khaali). Ye functions
--   pehle 610 se pehchana hua user_id lete hain, phir APP ke hi functions
--   (565 fn_my_khata_*, 582 fn_admin_pending_counts) ko USI user ki
--   pehchan par chalate hain: request.jwt.claim.sub sirf is transaction
--   ke liye set (set_config(..., true)). Is tarah WhatsApp aur app ka
--   jawab ek hi hisaab se aata hai.
-- * Role ki rok yahan bhi (app ke rok ke ilawa): sale / cash sirf
--   owner / admin / finance (manager: apni branch ki sale).
-- * Sirf service_role. anon / authenticated ko execute nahi -- koi bhi
--   login wala doosre ka user_id de kar parh na sake.

create or replace function public.fn_wa_act_as(p_user uuid)
returns void language plpgsql volatile security definer set search_path = public
as $$
begin
  if p_user is null then raise exception 'wa: user zaroori'; end if;
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
end $$;

create or replace function public.fn_wa_role(p_user uuid)
returns text language sql stable security definer set search_path = public
as $$ select p.role::text from public.profiles p where p.id = p_user and coalesce(p.is_active, true) $$;

-- Farmer / customer: apna khata (565 fn_my_khata_summary, usi user ki pehchan par)
create or replace function public.fn_wa_my_khata(p_user uuid)
returns jsonb language plpgsql volatile security definer set search_path = public
as $$
declare v jsonb;
begin
  perform public.fn_wa_act_as(p_user);
  select public.fn_my_khata_summary(null) into v;
  return v;
end $$;

-- Farmer / customer: akhri entries (bill / adaigi) -- 565 fn_my_khata_statement
create or replace function public.fn_wa_my_recent_lines(p_user uuid, p_limit int default 5)
returns table (entry_date date, ref text, category text, tafseel text, udhaar numeric, adaigi numeric, baqaya numeric)
language plpgsql volatile security definer set search_path = public
as $$
begin
  perform public.fn_wa_act_as(p_user);
  return query
    select s.entry_date, s.ref, s.category, s.tafseel, s.udhaar, s.adaigi, s.baqaya
      from public.fn_my_khata_statement((now() at time zone 'Asia/Karachi')::date - 90, null) s
     where not coalesce(s.is_opening, false)
     order by s.entry_date desc
     limit least(greatest(coalesce(p_limit, 5), 1), 10);
end $$;

-- Farmer / customer: apne orders (sirf 565 scope ke customer ids)
create or replace function public.fn_wa_my_orders(p_user uuid, p_limit int default 5)
returns table (order_number text, status text, grand_total numeric, created_at timestamptz)
language plpgsql volatile security definer set search_path = public
as $$
declare v_c uuid[];
begin
  perform public.fn_wa_act_as(p_user);
  select sc.customer_ids into v_c from public.fn_my_khata_scope() sc;
  return query
    select o.order_number, o.status, o.grand_total, o.created_at
      from public.agri_orders o
     where o.customer_id = any(coalesce(v_c, array[]::uuid[]))
     order by o.created_at desc
     limit least(greatest(coalesce(p_limit, 5), 1), 10);
end $$;

-- Owner / admin / finance: aaj ki sale (manager: sirf apni branch)
create or replace function public.fn_wa_today_sales(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_role text := public.fn_wa_role(p_user); v_branch uuid; v_day date := (now() at time zone 'Asia/Karachi')::date;
begin
  if v_role is null or v_role not in ('owner', 'super_admin', 'admin', 'finance', 'manager') then
    raise exception 'wa: aaj ki sale ki ijazat nahi';
  end if;
  if v_role = 'manager' then
    select p.branch_id into v_branch from public.profiles p where p.id = p_user;
    if v_branch is null then raise exception 'wa: manager ki branch nahi'; end if;
  end if;
  return (
    select jsonb_build_object(
      'day', v_day,
      'branch_scope', v_branch,
      'bills', count(*),
      'total', coalesce(sum(s.total_amount), 0),
      'cash', coalesce(sum(s.total_amount) filter (where s.payment_mode = 'cash'), 0),
      'khata', coalesce(sum(s.total_amount) filter (where s.payment_mode = 'khata'), 0),
      'other', coalesce(sum(s.total_amount) filter (where s.payment_mode not in ('cash', 'khata')), 0),
      'returned_bills', count(*) filter (where s.status in ('returned', 'partially_returned')))
    from public.pos_sales s
    where (s.created_at at time zone 'Asia/Karachi')::date = v_day
      and (v_branch is null or s.branch_id = v_branch));
end $$;

-- Owner / admin / finance: cash position (finance_accounts ka maujooda baqaya)
create or replace function public.fn_wa_cash_position(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_role text := public.fn_wa_role(p_user);
begin
  if v_role is null or v_role not in ('owner', 'super_admin', 'admin', 'finance') then
    raise exception 'wa: cash position ki ijazat nahi';
  end if;
  return (
    select jsonb_build_object(
      'cash', coalesce(sum(a.current_balance) filter (where a.account_type::text = 'cash'), 0),
      'bank', coalesce(sum(a.current_balance) filter (where a.account_type::text = 'bank'), 0),
      'wallet', coalesce(sum(a.current_balance) filter (where a.account_type::text = 'mobile_wallet'), 0),
      'other', coalesce(sum(a.current_balance) filter (where a.account_type::text = 'other'), 0),
      'accounts', count(*))
    from public.finance_accounts a where a.is_active);
end $$;

-- Har staff / admin: baqi kaam (582 fn_admin_pending_counts, usi user ki
-- pehchan aur branch scope par). Route ki ijazat app (loadNav) lagata hai.
create or replace function public.fn_wa_pending_counts(p_user uuid)
returns table (category text, group_key text, route text, pending int, mine_to_act int,
               oldest_at timestamptz, amount numeric, readable boolean, is_info boolean)
language plpgsql volatile security definer set search_path = public
as $$
declare v_role text := public.fn_wa_role(p_user);
begin
  if v_role is null or v_role in ('farmer', 'customer', 'customer_portal', 'ai_assistant') then
    raise exception 'wa: baqi kaam sirf staff / admin ke liye';
  end if;
  perform public.fn_wa_act_as(p_user);
  return query
    select c.category, c.group_key, c.route, c.pending, c.mine_to_act, c.oldest_at, c.amount, c.readable, c.is_info
      from public.fn_admin_pending_counts() c;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'fn_wa_act_as(uuid)', 'fn_wa_role(uuid)', 'fn_wa_my_khata(uuid)', 'fn_wa_my_recent_lines(uuid, int)',
    'fn_wa_my_orders(uuid, int)', 'fn_wa_today_sales(uuid)', 'fn_wa_cash_position(uuid)', 'fn_wa_pending_counts(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
