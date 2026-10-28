-- Recovery ke sensitive kaam sirf wazeh action permission ke sath.
insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('admin', 'finance.recovery', array['view','edit','send','receive','export']::text[], 'all'),
  ('owner', 'finance.recovery', array['view','edit','send','receive','export']::text[], 'all'),
  ('super_admin', 'finance.recovery', array['view','edit','send','receive','export']::text[], 'all')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;
