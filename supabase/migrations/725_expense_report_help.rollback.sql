-- 725 rollback: report ka feature aur madad. Koi kharcha, journal ya raqam nahi mitti.

delete from public.dashboard_features where feature_key = 'kharche.report';
delete from public.role_feature_permissions where feature_key = 'kharche.report';
delete from public.feature_help where feature_key = 'kharche.report';
delete from public.features where key = 'kharche.report';
