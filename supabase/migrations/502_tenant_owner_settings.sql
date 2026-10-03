-- AgriBridge OS v0.3.0 — tenant owner settings.
-- Only an organization's own super_admin may update its branding metadata.

drop policy if exists organization_owner_update on public.organizations;

create policy organization_owner_update
  on public.organizations
  for update
  to authenticated
  using (
    id = public.fn_current_user_organization_id()
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.organization_id = organizations.id
        and p.role = 'super_admin'
        and p.is_active = true
    )
  )
  with check (id = public.fn_current_user_organization_id());
