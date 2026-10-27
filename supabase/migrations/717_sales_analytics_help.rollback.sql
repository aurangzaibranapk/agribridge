-- 717 rollback: help aur feature hatao. Bikri aur rate waise hi rehte hain.

delete from public.dashboard_features where feature_key = 'reports.sales-analytics';
delete from public.feature_help where feature_key = 'reports.sales-analytics';
delete from public.role_feature_permissions where feature_key = 'reports.sales-analytics';
delete from public.features where key = 'reports.sales-analytics';
