-- 572: Customer Portal (Phase 5) -- gahak ka APNA data parhne ke functions.
--
-- Read-only. Koi table, column ya data nahi badalta (sirf functions).
-- Sab functions auth.uid() se khud scope nikalte hain (565 fn_my_khata_scope):
-- koi "kis ka" parameter nahi, is liye koi doosre gahak ka data nahi maang sakta.
--
-- Raaz nahi: kharid ki qeemat (unit_cost, line_cogs, total_cogs, profit),
-- staff ke notes, approve karne walon ke naam, doosri parties ki credit
-- limit -- in mein se kuch bhi wapas nahi aata.
--
-- Staff scope: owner/super_admin/admin/admin_assistant/finance -> sab gahak.
-- manager/sales_staff/cashier/accountant -> sirf apni branch (profiles.branch_id).
-- Jis login ki branch khali hai (6 shared department logins) -> koi gahak nahi,
-- jab tak dept-logins wala SQL manzoor na ho.
--
-- Dependency: 565 (fn_my_khata_scope / fn_my_khata_statement), 193 (fn_has_dept).

-- ---------------------------------------------------------------
-- Madadgar
-- ---------------------------------------------------------------
create or replace function public.fn_cp_my_customers()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce((select sc.customer_ids from public.fn_my_khata_scope() sc), array[]::uuid[]);
$$;
revoke all on function public.fn_cp_my_customers() from public, anon;
grant execute on function public.fn_cp_my_customers() to authenticated, service_role;

create or replace function public.fn_cp_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.fn_has_dept(array['owner','super_admin','admin','admin_assistant','finance']::public.user_role[]), false);
$$;
revoke all on function public.fn_cp_is_admin() from public, anon;
grant execute on function public.fn_cp_is_admin() to authenticated, service_role;

-- Kya ye staff is gahak ko dekh / check kar sakta hai?
create or replace function public.fn_cp_staff_can(p_customer uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or p_customer is null then return false; end if;
  -- Apna hi khata staff ki tarah nahi chala sakta
  if exists (select 1 from customers c where c.id = p_customer and c.user_id = v_uid) then return false; end if;
  if public.fn_cp_is_admin() then
    return exists (select 1 from customers c where c.id = p_customer);
  end if;
  return exists (
    select 1 from profiles p join customers c on c.id = p_customer
     where p.id = v_uid and coalesce(p.is_active, false)
       and p.branch_id is not null and c.branch_id = p.branch_id
       and (p.role in ('manager','sales_staff','cashier','accountant')
            or coalesce(p.extra_roles, array[]::public.user_role[]) && array['manager','sales_staff','cashier','accountant']::public.user_role[]));
end $$;
revoke all on function public.fn_cp_staff_can(uuid) from public, anon;
grant execute on function public.fn_cp_staff_can(uuid) to authenticated, service_role;

create or replace function public.fn_cp_mask_phone(p text)
returns text language sql immutable set search_path = public as $$
  select case when p is null or length(regexp_replace(p, '\D', '', 'g')) < 8 then p
    else left(regexp_replace(p, '\D', '', 'g'), 4) || '-•••-' || right(regexp_replace(p, '\D', '', 'g'), 4) end;
$$;
create or replace function public.fn_cp_mask_cnic(p text)
returns text language sql immutable set search_path = public as $$
  select case when p is null or length(regexp_replace(p, '\D', '', 'g')) < 6 then p
    else left(regexp_replace(p, '\D', '', 'g'), 5) || '-•••••••-' || right(regexp_replace(p, '\D', '', 'g'), 1) end;
$$;
create or replace function public.fn_cp_code(p uuid)
returns text language sql immutable set search_path = public as $$
  select 'C-' || upper(left(replace(p::text, '-', ''), 6));
$$;

-- ---------------------------------------------------------------
-- Meri profile
-- ---------------------------------------------------------------
create or replace function public.fn_my_customer_profile()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[] := public.fn_cp_my_customers();
begin
  if coalesce(cardinality(v_ids), 0) = 0 then return null; end if;
  return (
    select jsonb_build_object(
      'customers', coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'code', public.fn_cp_code(c.id), 'name', c.name, 'business_name', c.business_name,
        'customer_type', c.customer_type, 'branch', (select b.name from branches b where b.id = c.branch_id),
        'phone', public.fn_cp_mask_phone(c.phone_number), 'cnic', public.fn_cp_mask_cnic(c.cnic),
        'email', c.email, 'address', c.address, 'contact_person', c.contact_person,
        'credit_limit', coalesce(c.credit_limit, 0), 'payment_due_days', c.payment_due_days,
        'overdue_block_days', c.overdue_block_days, 'is_active', coalesce(c.is_active, true),
        'has_phone', c.phone_number is not null and length(trim(c.phone_number)) > 0,
        'farmer_code', (select f.farmer_code from farmers f where f.id = c.farmer_id),
        'terms_version', (select p.terms_version from payment_promises p
                           where p.party_type = 'customer' and p.party_id = c.id and p.terms_version is not null
                           order by p.created_at desc limit 1),
        'terms_at', (select p.terms_accepted_at from payment_promises p
                      where p.party_type = 'customer' and p.party_id = c.id and p.terms_accepted_at is not null
                      order by p.created_at desc limit 1)
      ) order by c.created_at nulls last, c.name), '[]'::jsonb),
      'farmer_linked', exists (select 1 from fn_my_khata_scope() s where s.farmer_id is not null)
    )
    from customers c where c.id = any(v_ids) and not coalesce(c.is_deleted, false)
  );
end $$;
revoke all on function public.fn_my_customer_profile() from public, anon;
grant execute on function public.fn_my_customer_profile() to authenticated, service_role;

-- ---------------------------------------------------------------
-- Mere bill (POS) -- sirf bechne ki qeemat; kharid ki qeemat / munafa NAHI
-- ---------------------------------------------------------------
create or replace function public.fn_my_bills(p_from date default null, p_to date default null, p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[] := public.fn_cp_my_customers();
begin
  if coalesce(cardinality(v_ids), 0) = 0 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(b order by b->>'date' desc, b->>'ref' desc) from (
      select jsonb_build_object(
        'id', s.id,
        'ref', 'POS-' || to_char(s.created_at at time zone 'Asia/Karachi', 'YYMMDD') || '-' || upper(left(replace(s.id::text, '-', ''), 5)),
        'date', (s.created_at at time zone 'Asia/Karachi')::date,
        'total', coalesce(s.total_amount, 0), 'cash', coalesce(s.cash_paid, 0), 'khata', coalesce(s.khata_amount, 0),
        'mode', s.payment_mode, 'status', coalesce(s.status, 'completed'),
        'items', coalesce((select jsonb_agg(jsonb_build_object('name', pr.name, 'qty', i.quantity, 'rate', i.unit_price, 'amount', i.subtotal) order by pr.name)
                             from pos_sale_items i left join products pr on pr.id = i.product_id where i.sale_id = s.id), '[]'::jsonb)
      ) b
      from pos_sales s
      where s.crm_customer_id = any(v_ids)
        and (p_from is null or (s.created_at at time zone 'Asia/Karachi')::date >= p_from)
        and (p_to is null or (s.created_at at time zone 'Asia/Karachi')::date <= p_to)
      order by s.created_at desc
      limit greatest(1, least(coalesce(p_limit, 100), 500))
    ) z), '[]'::jsonb);
end $$;
revoke all on function public.fn_my_bills(date, date, int) from public, anon;
grant execute on function public.fn_my_bills(date, date, int) to authenticated, service_role;

-- ---------------------------------------------------------------
-- Mere orders (agri_orders) -- marhale sirf haan/nahi, naam nahi
-- ---------------------------------------------------------------
create or replace function public.fn_my_orders(p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[] := public.fn_cp_my_customers();
begin
  if coalesce(cardinality(v_ids), 0) = 0 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(o order by o->>'created_at' desc) from (
      select jsonb_build_object(
        'id', a.id, 'number', coalesce(a.order_id_display, a.order_number), 'created_at', a.created_at,
        'date', (a.created_at at time zone 'Asia/Karachi')::date, 'type', a.order_type,
        'subtotal', coalesce(a.subtotal, 0), 'discount', coalesce(a.discount, 0), 'freight', coalesce(a.freight_charges, 0),
        'grand_total', coalesce(a.grand_total, 0), 'payment_terms', a.payment_terms, 'due_date', a.payment_due_date,
        'status', a.status,
        'steps', jsonb_build_object('placed', true, 'sales', a.sales_verified_at is not null, 'finance', a.finance_verified_at is not null,
                   'approved', a.approved_at is not null, 'delivered', a.status in ('delivered','completed')),
        'rejected', a.rejection_reason is not null and a.approved_at is null,
        'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.product_name, 'pack', i.pack_size, 'qty', i.order_qty,
                     'rate', i.net_price, 'amount', i.line_total) order by i.created_at) from agri_order_items i where i.order_id = a.id), '[]'::jsonb)
      ) o
      from agri_orders a where a.customer_id = any(v_ids)
      order by a.created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) z), '[]'::jsonb);
end $$;
revoke all on function public.fn_my_orders(int) from public, anon;
grant execute on function public.fn_my_orders(int) to authenticated, service_role;

-- ---------------------------------------------------------------
-- Meri wapsiyan (POS + order returns)
-- ---------------------------------------------------------------
create or replace function public.fn_my_returns()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[] := public.fn_cp_my_customers();
begin
  if coalesce(cardinality(v_ids), 0) = 0 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'date' desc) from (
      select jsonb_build_object('kind', 'pos', 'ref', coalesce(r.return_number, 'RT-' || upper(left(replace(r.id::text, '-', ''), 6))),
               'date', (r.created_at at time zone 'Asia/Karachi')::date, 'amount', coalesce(r.total_amount, 0), 'status', 'done') x
        from pos_returns r join pos_sales s on s.id = r.sale_id where s.crm_customer_id = any(v_ids)
      union all
      select jsonb_build_object('kind', 'order', 'ref', coalesce(ar.return_number, 'ORT-' || upper(left(replace(ar.id::text, '-', ''), 6))),
               'date', (ar.created_at at time zone 'Asia/Karachi')::date, 'amount', coalesce(ar.total_amount, 0), 'status', ar.status)
        from agri_order_returns ar join agri_orders a on a.id = ar.order_id where a.customer_id = any(v_ids)
    ) z), '[]'::jsonb);
end $$;
revoke all on function public.fn_my_returns() from public, anon;
grant execute on function public.fn_my_returns() to authenticated, service_role;

-- ---------------------------------------------------------------
-- Mere wade (customer + linked farmer) -- notes / assigned_to nahi
-- ---------------------------------------------------------------
create or replace function public.fn_my_promises()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_f uuid; v_ids uuid[];
begin
  select sc.farmer_id, sc.customer_ids into v_f, v_ids from fn_my_khata_scope() sc;
  if v_f is null and coalesce(cardinality(v_ids), 0) = 0 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'date', p.promise_date, 'amount', coalesce(p.promised_amount, 0),
             'fulfilled', coalesce(p.fulfilled_amount, 0), 'status', p.status, 'channel', p.terms_channel, 'created_at', p.created_at)
             order by p.promise_date desc)
      from payment_promises p
     where (p.party_type = 'customer' and p.party_id = any(coalesce(v_ids, array[]::uuid[])))
        or (p.party_type = 'farmer' and v_f is not null and p.party_id = v_f)), '[]'::jsonb);
end $$;
revoke all on function public.fn_my_promises() from public, anon;
grant execute on function public.fn_my_promises() to authenticated, service_role;

-- ---------------------------------------------------------------
-- Meri adaigiyan -- khata (565) ki "adaigi" lakeerein
-- ---------------------------------------------------------------
create or replace function public.fn_my_payments(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('date', s.entry_date, 'ref', s.ref, 'kind', s.kind, 'amount', s.adaigi) order by s.entry_date desc, s.ref desc)
      from public.fn_my_khata_statement(p_from, p_to) s
     where not s.is_opening and s.category = 'adaigi' and s.adaigi > 0), '[]'::jsonb);
end $$;
revoke all on function public.fn_my_payments(date, date) from public, anon;
grant execute on function public.fn_my_payments(date, date) to authenticated, service_role;
