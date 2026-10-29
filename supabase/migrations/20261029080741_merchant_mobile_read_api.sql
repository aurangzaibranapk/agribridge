-- Safe mobile read surface: resolves the signed-in merchant on the server.
-- Admin TEST role switching cannot read unrelated merchant money.

do $$
begin
  if to_regclass('public.app_test_links') is not null then
    alter table public.app_test_links drop constraint if exists app_test_links_role_check;
    alter table public.app_test_links add constraint app_test_links_role_check
      check (role in ('admin','farmer','customer','mca','mco','vet','staff','dealer','supplier'));
  end if;
end
$$;

create or replace function public.fn_my_merchant_settlements(p_role text)
returns table (
  settlement_number text,
  source_type text,
  gross_amount numeric,
  commission_amount numeric,
  net_amount numeric,
  due_date date,
  status text,
  bank_reference text,
  paid_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = '' as $$
declare
  v_role text := lower(coalesce(p_role, ''));
  v_merchant_id uuid;
begin
  if v_role not in ('dealer','supplier') then
    raise exception 'Merchant role theek nahi.';
  end if;

  if v_role = 'dealer' then
    select d.id into v_merchant_id
    from public.dealers d
    where d.user_id = auth.uid() and d.is_active
    order by d.created_at limit 1;
  else
    select s.id into v_merchant_id
    from public.suppliers s
    where s.user_id = auth.uid() and s.is_active
    order by s.created_at limit 1;
  end if;

  if v_merchant_id is null and to_regclass('public.app_test_links') is not null then
    select l.record_id into v_merchant_id
    from public.app_test_links l
    join public.app_test_accounts a on a.profile_id = l.account_id
    where l.account_id = auth.uid() and l.role = v_role
      and l.record_table = case when v_role = 'dealer' then 'dealers' else 'suppliers' end
    limit 1;
  end if;

  if v_merchant_id is null then return; end if;

  return query
  select s.settlement_number, s.source_type, s.gross_amount,
         s.commission_amount, s.net_amount, s.due_date, s.status,
         s.bank_reference, s.paid_at, s.created_at
  from public.merchant_settlements s
  where s.merchant_role = v_role and s.merchant_id = v_merchant_id
  order by s.created_at desc
  limit 50;
end
$$;

revoke execute on function public.fn_my_merchant_settlements(text) from public, anon;
grant execute on function public.fn_my_merchant_settlements(text) to authenticated;

comment on function public.fn_my_merchant_settlements(text) is
  'Returns only the signed-in dealer/supplier settlement rows, including a TEST link when explicitly configured.';
