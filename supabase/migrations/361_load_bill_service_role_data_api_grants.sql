-- Load/Bill tables are accessed only from trusted server actions through
-- SUPABASE_SERVICE_ROLE_KEY. The original migrations created these tables
-- without Data API privileges, so PostgREST returned 403 and the page
-- incorrectly appeared to have no provider account.
--
-- Do not grant these privileges to anon or authenticated here. Staff access
-- remains enforced by the application permission checks, while this grant is
-- limited to the server-only service_role.

grant select, insert, update, delete
on table
  public.load_accounts,
  public.load_providers,
  public.load_transactions,
  public.load_commission_rules,
  public.load_float_moves,
  public.load_reconciliations
to service_role;
