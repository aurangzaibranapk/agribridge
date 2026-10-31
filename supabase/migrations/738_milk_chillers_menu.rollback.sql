-- 738 rollback. Chiller list ka menu hatao.
delete from public.dashboard_features where feature_key = 'milk-collection.chillers';
delete from public.role_feature_permissions where feature_key = 'milk-collection.chillers';
delete from public.features where key = 'milk-collection.chillers';
