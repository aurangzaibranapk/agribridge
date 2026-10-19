-- 585: Mobile product catalog aur role dashboard khulasa (read-only).
-- Port of testing 380 + 20261010050002, live schema ke mutabiq:
--  * shop_inventory table live par nahi; dukaan ka stock inventory.shop_id mein.
--  * Sirf wohi cheezein jo checkout (588) qubool karta hai: verified,
--    qeemat > 0, expiry guzri na ho. Khareed qeemat (cost) kabhi nahi bhejte.
-- Sirf additive. Live par sirf owner ki manzoori ke baad.

create or replace function public.mobile_product_catalog(p_limit integer default 100)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_master boolean;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai'; end if;
  select * into v_profile from profiles where id = auth.uid() and coalesce(is_active, true);
  if not found then raise exception 'Active profile zaroori hai'; end if;
  v_master := v_profile.role::text in ('owner', 'super_admin', 'admin');

  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.name)
      from (
        select p.id, p.name, p.pack_size, p.unit, p.selling_price, p.image_url,
               case when coalesce(p.show_expiry_to_customer, true) then p.expiry_date end as expiry_date,
               c.name as category_name, b.name as brand_name,
               coalesce((select sum(i.quantity_on_hand)
                           from inventory i join warehouses w on w.id = i.warehouse_id
                          where i.product_id = p.id and i.shop_id is null
                            and (w.branch_id = v_profile.branch_id or (v_profile.branch_id is null and v_master))), 0) as warehouse_stock,
               coalesce((select sum(i.quantity_on_hand)
                           from inventory i
                          where i.product_id = p.id and i.shop_id is not null
                            and (i.shop_id = v_profile.shop_id or (v_profile.shop_id is null and v_master))), 0) as shop_stock
          from products p
          left join categories c on c.id = p.category_id
          left join brands b on b.id = p.brand_id
         where p.organization_id = v_profile.organization_id
           and coalesce(p.is_available, false) and not coalesce(p.is_deleted, false)
           and coalesce(p.is_verified, false) and coalesce(p.selling_price, 0) > 0
           and (p.expiry_date is null or p.expiry_date >= v_today)
         order by p.name
         limit greatest(1, least(coalesce(p_limit, 100), 200))
      ) r
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.mobile_product_catalog(integer) from public, anon;
grant execute on function public.mobile_product_catalog(integer) to authenticated;

create or replace function public.mobile_role_dashboard_summary()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_manager boolean;
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi';
  v_today_orders integer := 0; v_today_value numeric := 0; v_pending_orders integer := 0;
  v_unread integer := 0; v_features integer := 0; v_requests integer := 0; v_office integer := 0;
  v_dealer_payable numeric := 0;
begin
  if auth.uid() is null then raise exception 'Login zaroori hai'; end if;
  select * into v_profile from profiles where id = auth.uid() and coalesce(is_active, true);
  if not found then raise exception 'Active profile zaroori hai'; end if;
  v_manager := v_profile.role::text in ('owner', 'super_admin', 'admin', 'manager');

  select count(*), coalesce(sum(o.grand_total), 0) into v_today_orders, v_today_value
    from agri_orders o join profiles rq on rq.id = o.requested_by
   where rq.organization_id = v_profile.organization_id and o.created_at >= v_today
     and (v_manager or o.requested_by = auth.uid())
     and (v_profile.branch_id is null or o.order_to_branch_id = v_profile.branch_id);

  select count(*) into v_pending_orders
    from agri_orders o join profiles rq on rq.id = o.requested_by
   where rq.organization_id = v_profile.organization_id
     and o.status in ('submitted', 'sales_verified', 'finance_verified', 'approved', 'processing', 'dispatched', 'in_transit')
     and (v_manager or o.requested_by = auth.uid())
     and (v_profile.branch_id is null or o.order_to_branch_id = v_profile.branch_id);

  select count(*) into v_unread from notifications where recipient_user_id = auth.uid() and not coalesce(is_read, false);
  select count(distinct feature_key) into v_features from v_user_feature_access where profile_id = auth.uid();
  select count(*) into v_requests from mobile_service_requests
   where profile_id = auth.uid() and status in ('submitted', 'in_review', 'approved', 'scheduled');
  if v_manager then
    select count(*) into v_office from mobile_service_requests
     where organization_id = v_profile.organization_id and status in ('submitted', 'in_review')
       and profile_id <> auth.uid();
  end if;
  select coalesce(max(current_payable), 0) into v_dealer_payable from dealers where user_id = auth.uid() and coalesce(is_active, true);

  return jsonb_build_object(
    'today_orders', v_today_orders, 'today_order_value', v_today_value,
    'pending_orders', v_pending_orders, 'unread_notifications', v_unread,
    'allowed_features', v_features, 'open_service_requests', v_requests,
    'office_service_inbox', v_office, 'dealer_payable', v_dealer_payable);
end;
$$;
revoke all on function public.mobile_role_dashboard_summary() from public, anon;
grant execute on function public.mobile_role_dashboard_summary() to authenticated;

notify pgrst, 'reload schema';
