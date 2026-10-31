-- 739 rollback. Admin dashboard ka menu hatao.
delete from public.dashboard_features where feature_key = 'milk-collection.dashboard';
delete from public.role_feature_permissions where feature_key = 'milk-collection.dashboard';
delete from public.features where key = 'milk-collection.dashboard';
