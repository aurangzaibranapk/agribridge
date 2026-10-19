-- =====================================================================
-- 596: Kharche, load ki kamai aur udhaar baqaya -- sirf jin ka kaam hai.
--
-- 17 October audit: database ki read rules (RLS) bohat dheeli thin:
--   * finance_transactions (kharche / cash book): HAR staff parh sakta
--     tha (finance_txn_staff_parh_sakta), aur tenant_scoped_access (ALL)
--     manager/sales_staff ko bhi poori cash book dikhata tha.
--   * load_transactions (load/bill + hamari kamai): HAR staff, sab branches.
--   * customers (udhaar baqaya): HAR staff, sab branches.
--
-- Naye qaide (sirf SELECT badla; likhne ke qaide wese ke wese):
--   finance_transactions: owner / super_admin / admin / finance -> sab.
--                         Baqi staff -> sirf wo qatar jo unhon ne khud
--                         darj ki (taake insert...returning aur apni entry
--                         ki wapsi na tootay).
--   load_transactions:    owner / super_admin / admin / finance -> sab.
--                         manager -> apni branch. Baqi -> apni darj ki hui.
--                         (Load/Bill safha aur shift ka hisaab service
--                         client se parhte hain -- un par asar nahi.)
--   customers:            owner / super_admin / admin / admin_assistant /
--                         finance -> sab. Baqi staff -> sirf apni branch.
--                         Gahak apna khud ka record (customer_own_profile)
--                         pehle jaisa.
--
-- Pehle chalayein: department logins ki branch set karne wala proposal
-- (docs/proposals/sales-secrets-dept-logins.sql) -- warna jis login ki
-- branch khali hai us ko koi gahak nazar nahi aayega.
--
-- created_by khali reh jata tha (default null) -- ek BEFORE INSERT
-- trigger ab auth.uid() bhar deta hai, taake "apni darj ki hui" qaida
-- kaam kare. Service client (auth.uid() null) par koi farq nahi.
--
-- Wapas: supabase/rollbacks/596_finance_load_customer_read_scope.down.sql
-- Dobara chalana mehfooz (drop policy if exists / create).
-- =====================================================================

-- ---------- madadgar: kaun poori kitab dekh sakta hai ----------
create or replace function public.fn_can_read_all_money()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.fn_has_dept(array['owner','super_admin','admin','finance']::public.user_role[]);
$$;
-- anon ko bhi execute chahiye: RLS policy har role par chalti hai, aur
-- bina execute ke anon ki query khali jawab ki jagah error deti. Anon ke
-- liye ye hamesha false lautata hai (auth.uid() null).
grant execute on function public.fn_can_read_all_money() to anon, authenticated, service_role;

create or replace function public.fn_set_created_by_default()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if new.created_by is null and auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end
$$;

drop trigger if exists trg_finance_txn_created_by on public.finance_transactions;
create trigger trg_finance_txn_created_by
  before insert on public.finance_transactions
  for each row execute function public.fn_set_created_by_default();

drop trigger if exists trg_load_txn_created_by on public.load_transactions;
create trigger trg_load_txn_created_by
  before insert on public.load_transactions
  for each row execute function public.fn_set_created_by_default();

-- ---------- cash book ka balance-guard ----------
-- finance_accounts par fn_guard_finance_balance trigger balance ko
-- fn_finance_account_true_balance() se milata hai, jo finance_transactions
-- ka JOR leta hai. Ye dono "invoker" the -- yani jor bhi user ki RLS ke
-- andar banta. Neeche ka naya read qaida sales staff ko sirf apni qatarein
-- dikhata hai, to un ki har cash-book entry par jor ghalat aata aur entry
-- "balance seedha nahi likha ja sakta" kehkar ruk jati. Guard ab definer
-- hai (table owner ke taur par poora jor leta hai). Trigger function RPC
-- se bulaya nahi ja sakta, is liye is se koi raasta nahi khulta.
alter function public.fn_guard_finance_balance() security definer;
alter function public.fn_guard_finance_balance() set search_path = public;

-- ---------- finance_transactions ----------
drop policy if exists finance_txn_staff_parh_sakta on public.finance_transactions;
drop policy if exists tenant_scoped_access on public.finance_transactions;
drop policy if exists finance_txn_read_scoped on public.finance_transactions;
drop policy if exists finance_txn_tenant_insert on public.finance_transactions;
drop policy if exists finance_txn_tenant_update on public.finance_transactions;
drop policy if exists finance_txn_tenant_delete on public.finance_transactions;

-- Likhne ke qaide: bilkul wohi shart jo tenant_scoped_access ki thi.
create policy finance_txn_tenant_insert on public.finance_transactions
  for insert with check (
    fn_has_dept(array['super_admin','admin','manager','sales_staff']::user_role[])
    and exists (select 1 from finance_accounts a
                 where a.id = finance_transactions.account_id
                   and a.organization_id = fn_current_user_organization_id())
  );
create policy finance_txn_tenant_update on public.finance_transactions
  for update using (
    fn_has_dept(array['super_admin','admin','manager','sales_staff']::user_role[])
    and exists (select 1 from finance_accounts a
                 where a.id = finance_transactions.account_id
                   and a.organization_id = fn_current_user_organization_id())
  ) with check (
    fn_has_dept(array['super_admin','admin','manager','sales_staff']::user_role[])
    and exists (select 1 from finance_accounts a
                 where a.id = finance_transactions.account_id
                   and a.organization_id = fn_current_user_organization_id())
  );
create policy finance_txn_tenant_delete on public.finance_transactions
  for delete using (
    fn_has_dept(array['super_admin','admin','manager','sales_staff']::user_role[])
    and exists (select 1 from finance_accounts a
                 where a.id = finance_transactions.account_id
                   and a.organization_id = fn_current_user_organization_id())
  );

-- Parhne ka qaida: poori kitab sirf owner/admin/finance; baqi apni entry.
create policy finance_txn_read_scoped on public.finance_transactions
  for select using (
    fn_can_read_all_money()
    or (fn_is_any_staff() and created_by = auth.uid())
  );

-- ---------- load_transactions ----------
drop policy if exists staff_read_load_transactions on public.load_transactions;
drop policy if exists load_txn_read_scoped on public.load_transactions;
create policy load_txn_read_scoped on public.load_transactions
  for select using (
    fn_can_read_all_money()
    or (fn_has_dept(array['manager']::user_role[])
        and branch_id is not null and branch_id = fn_current_user_branch_id())
    or (fn_is_any_staff() and created_by = auth.uid())
  );

-- ---------- customers ----------
drop policy if exists customer_org_read on public.customers;
drop policy if exists customer_branch_read on public.customers;
create policy customer_branch_read on public.customers
  for select using (
    organization_id = fn_current_user_organization_id()
    and fn_is_any_staff()
    and (
      fn_has_dept(array['owner','super_admin','admin','admin_assistant','finance']::user_role[])
      or (branch_id is not null and branch_id = fn_current_user_branch_id())
    )
  );
