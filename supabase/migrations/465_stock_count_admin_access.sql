-- Stock Count: Admin role ko approve + full access do
-- UNRESTRICTED_ROLES mein admin pehle se hai (code level),
-- lekin role_feature_permissions mein explicit entry nahi thi.
-- Ab DB mein bhi saaf likha hai -- consistency ke liye.

insert into role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('admin', 'stock-count', array['view','create','edit','verify','approve','reject','export','assign'], 'all')
on conflict (role, feature_key) do update
  set actions     = excluded.actions,
      data_scope  = excluded.data_scope;
