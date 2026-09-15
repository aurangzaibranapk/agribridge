-- =====================================================================
-- Migration 095: "Staff can manage ..." wale rules ko waqai staff-only karo
-- =====================================================================
-- In tables ke rules ka naam "Staff can manage" tha, magar shart sirf
-- "auth.uid() is not null" thi — yani koi bhi login wala (kisan, customer,
-- dealer) inhein parh aur badal sakta tha. Neeyat theek thi, likhayi mein
-- galti reh gayi thi. Ab shart naam se mel khati hai.
--
-- Ye sab andaruni (staff) tables hain — code mein inhein sirf src/actions
-- aur src/app/admin istemal karte hain, koi farmer/dealer/vendor portal
-- nahi. Is liye rok lagane se koi portal nahi tootta.
--
-- credit_category_limits jaan boojh kar chhoR di gayi — us ke rule ka naam
-- hi "public_read_credit_limits" hai, yani khula parhna maqsood tha.

-- fn_is_staff sirf 4 roles jaanta hai (super_admin/admin/manager/
-- sales_staff) — us se finance, warehouse, hr waghera bahar reh jate.
create or replace function public.fn_is_any_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
    and role in ('owner','super_admin','admin','admin_assistant','manager',
                 'sales_staff','finance','warehouse','hr','procurement','milk_collection')
  );
$$;

do $$
declare
  r record;
  targets text[] := array[
    'agri_orders','agri_delivery_items','driver_payments','drivers','dispatch_vehicles',
    'vehicle_maintenance_records','grain_expenses','grain_parties','grain_sale_counters',
    'grain_sale_payments','grain_sales','stock_loss_counters','stock_loss_records',
    'payment_method_account_map','machinery_booking_counters','farmer_loans',
    'farmer_subscriptions','investor_investments','investor_returns','shops',
    'loss_verifiers','machinery_vendor_machines','buyer_payments','dealer_payments',
    'product_edit_requests','ai_purchase_suggestions','bridge_ai_settings',
    'bridge_ai_activity_log','bridge_ai_action_requests'
  ];
begin
  for r in
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public' and tablename = any(targets)
      and (qual ilike '%auth.uid() IS NOT NULL%' or qual = 'true')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    if r.cmd = 'ALL' then
      execute format('create policy %I on public.%I for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff())', r.policyname, r.tablename);
    elsif r.cmd = 'SELECT' then
      execute format('create policy %I on public.%I for select using (public.fn_is_any_staff())', r.policyname, r.tablename);
    elsif r.cmd = 'UPDATE' then
      execute format('create policy %I on public.%I for update using (public.fn_is_any_staff()) with check (public.fn_is_any_staff())', r.policyname, r.tablename);
    elsif r.cmd = 'INSERT' then
      execute format('create policy %I on public.%I for insert with check (public.fn_is_any_staff())', r.policyname, r.tablename);
    elsif r.cmd = 'DELETE' then
      execute format('create policy %I on public.%I for delete using (public.fn_is_any_staff())', r.policyname, r.tablename);
    end if;
  end loop;
end $$;
