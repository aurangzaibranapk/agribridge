-- Allow the grain party side of the ledger to record customer receipts while
-- keeping farmer and tenant isolation in place.

alter table public.grain_parties
  add column if not exists organization_id uuid;

update public.grain_parties
set organization_id = public.fn_default_organization_id()
where organization_id is null;

alter table public.grain_parties
  alter column organization_id set default public.fn_default_organization_id();

do $$
declare
  t text;
begin
  foreach t in array array['grain_procurement_entries', 'grain_procurement_payments']
  loop
    execute format('drop policy if exists tenant_scoped_access on public.%I', t);
    execute format($policy$
      create policy tenant_scoped_access on public.%I for all
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.is_active = true
            and p.role in ('super_admin','admin','manager','sales_staff')
        )
        and (
          exists (select 1 from public.farmers f
            where f.id = %I.farmer_id
              and f.organization_id = public.fn_current_user_organization_id())
          or exists (select 1 from public.grain_parties gp
            where gp.id = %I.party_id
              and gp.organization_id = public.fn_current_user_organization_id())
        )
      )
      with check (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.is_active = true
            and p.role in ('super_admin','admin','manager','sales_staff')
        )
        and (
          exists (select 1 from public.farmers f
            where f.id = %I.farmer_id
              and f.organization_id = public.fn_current_user_organization_id())
          or exists (select 1 from public.grain_parties gp
            where gp.id = %I.party_id
              and gp.organization_id = public.fn_current_user_organization_id())
        )
      )
    $policy$, t, t, t, t, t);
  end loop;
end $$;
