-- Keep grain payment tenant isolation while using the canonical staff-role check.
-- This fixes valid owner/department staff accounts being rejected by the
-- previous hard-coded role list. Existing records are not changed.

drop policy if exists tenant_scoped_access on public.grain_procurement_payments;

create policy tenant_scoped_access
on public.grain_procurement_payments
for all
to public
using (
  public.fn_is_any_staff()
  and (
    exists (
      select 1
      from public.farmers f
      where f.id = grain_procurement_payments.farmer_id
        and f.organization_id = public.fn_current_user_organization_id()
    )
    or exists (
      select 1
      from public.grain_parties gp
      where gp.id = grain_procurement_payments.party_id
        and gp.organization_id = public.fn_current_user_organization_id()
    )
  )
)
with check (
  public.fn_is_any_staff()
  and (
    exists (
      select 1
      from public.farmers f
      where f.id = grain_procurement_payments.farmer_id
        and f.organization_id = public.fn_current_user_organization_id()
    )
    or exists (
      select 1
      from public.grain_parties gp
      where gp.id = grain_procurement_payments.party_id
        and gp.organization_id = public.fn_current_user_organization_id()
    )
  )
);
