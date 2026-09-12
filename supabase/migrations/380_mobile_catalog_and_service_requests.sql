-- Authenticated mobile catalog with branch/shop stock and farmer service requests.

create table if not exists public.mobile_service_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('machinery_booking','grain_sale','veterinary_service','crop_doctor')),
  details jsonb not null default '{}'::jsonb,
  branch_id uuid references public.branches(id),
  shop_id uuid references public.shops(id),
  status text not null default 'submitted' check (status in ('submitted','in_review','approved','scheduled','completed','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mobile_service_requests enable row level security;

drop policy if exists mobile_service_requests_own_read on public.mobile_service_requests;
create policy mobile_service_requests_own_read on public.mobile_service_requests
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists mobile_service_requests_own_insert on public.mobile_service_requests;
create policy mobile_service_requests_own_insert on public.mobile_service_requests
  for insert to authenticated with check (
    profile_id = auth.uid()
    and branch_id is not distinct from (select branch_id from public.profiles where id = auth.uid())
    and shop_id is not distinct from (select shop_id from public.profiles where id = auth.uid())
  );

drop policy if exists mobile_service_requests_admin_manage on public.mobile_service_requests;
create policy mobile_service_requests_admin_manage on public.mobile_service_requests
  for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and is_active and role::text in ('owner','super_admin','admin','manager'))
  ) with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_active and role::text in ('owner','super_admin','admin','manager'))
  );

create index if not exists mobile_service_requests_profile_idx
  on public.mobile_service_requests(profile_id, created_at desc);

create or replace function public.mobile_product_catalog(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select * into v_profile from profiles where id = auth.uid() and is_active;
  if not found then raise exception 'Active profile required'; end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by row_data.name), '[]'::jsonb)
    into v_result
    from (
      select p.id, p.name, p.pack_size, p.unit, p.selling_price, p.image_url,
             p.expiry_date,
             c.name as category_name, b.name as brand_name,
             coalesce((
               select sum(i.quantity_on_hand)
                 from inventory i
                 join warehouses w on w.id = i.warehouse_id
                where i.product_id = p.id
                  and (
                    w.branch_id = v_profile.branch_id
                    or (v_profile.branch_id is null and v_profile.role::text in ('owner','super_admin','admin'))
                  )
             ), 0) as warehouse_stock,
             coalesce((
               select sum(si.stock_quantity)
                 from shop_inventory si
                where si.product_id = p.id
                  and (
                    si.shop_id = v_profile.shop_id
                    or (v_profile.shop_id is null and v_profile.role::text in ('owner','super_admin','admin'))
                  )
             ), 0) as shop_stock
        from products p
        left join categories c on c.id = p.category_id
        left join brands b on b.id = p.brand_id
       where p.organization_id = v_profile.organization_id
         and p.is_available and not p.is_deleted
       order by p.name
       limit greatest(1, least(coalesce(p_limit, 100), 200))
    ) row_data;
  return v_result;
end;
$$;

revoke all on function public.mobile_product_catalog(integer) from public;
grant execute on function public.mobile_product_catalog(integer) to authenticated;

create or replace function public.mobile_role_dashboard_summary()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_today_orders integer := 0;
  v_today_value numeric := 0;
  v_pending_orders integer := 0;
  v_unread integer := 0;
  v_features integer := 0;
  v_requests integer := 0;
  v_dealer_payable numeric := 0;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select * into v_profile from profiles where id = auth.uid() and is_active;
  if not found then raise exception 'Active profile required'; end if;

  select count(*), coalesce(sum(o.grand_total), 0)
    into v_today_orders, v_today_value
    from agri_orders o
    join profiles requester on requester.id = o.requested_by
   where requester.organization_id = v_profile.organization_id
     and o.created_at >= current_date
     and (v_profile.role::text in ('owner','super_admin','admin','manager') or o.requested_by = auth.uid())
     and (v_profile.branch_id is null or o.order_to_branch_id = v_profile.branch_id);

  select count(*) into v_pending_orders
    from agri_orders o
    join profiles requester on requester.id = o.requested_by
   where requester.organization_id = v_profile.organization_id
     and o.status in ('submitted','sales_verified','finance_verified','approved','processing','dispatched','in_transit')
     and (v_profile.role::text in ('owner','super_admin','admin','manager') or o.requested_by = auth.uid())
     and (v_profile.branch_id is null or o.order_to_branch_id = v_profile.branch_id);

  select count(*) into v_unread from notifications where recipient_user_id = auth.uid() and not is_read;
  select count(distinct feature_key) into v_features from v_user_feature_access where profile_id = auth.uid();
  select count(*) into v_requests from mobile_service_requests where profile_id = auth.uid() and status in ('submitted','in_review','approved','scheduled');
  select coalesce(max(current_payable), 0) into v_dealer_payable from dealers where user_id = auth.uid() and is_active;

  return jsonb_build_object(
    'today_orders', v_today_orders,
    'today_order_value', v_today_value,
    'pending_orders', v_pending_orders,
    'unread_notifications', v_unread,
    'allowed_features', v_features,
    'open_service_requests', v_requests,
    'dealer_payable', v_dealer_payable
  );
end;
$$;

revoke all on function public.mobile_role_dashboard_summary() from public;
grant execute on function public.mobile_role_dashboard_summary() to authenticated;

notify pgrst, 'reload schema';
