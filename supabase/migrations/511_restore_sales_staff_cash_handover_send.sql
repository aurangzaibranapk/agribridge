-- Sales staff must be able to send only cash already in their own custody
-- after closing a POS shift. Migration 428 is present in Live migration
-- history, but the sales_staff template row was removed later. Preserve any
-- other permissions an administrator has already configured.
insert into role_feature_permissions (role, feature_key, actions, data_scope)
values ('sales_staff', 'cash-handover', array['send']::text[], 'own_records')
on conflict (role, feature_key) do update
set actions = array(
  select distinct action
  from unnest(coalesce(role_feature_permissions.actions, array[]::text[]) || array['send']::text[]) as action
  order by action
);
