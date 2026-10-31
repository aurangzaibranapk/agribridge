-- 735 rollback. Control room sidebar qatar hatao.
delete from public.dashboard_features where feature_key = 'milk-collection.control-room';
delete from public.role_feature_permissions where feature_key = 'milk-collection.control-room';
delete from public.features where key = 'milk-collection.control-room';
