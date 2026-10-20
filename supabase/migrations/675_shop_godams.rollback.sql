-- 675 wapas. Link mit jate hain. POS phir Godam — dikhata hai.

delete from public.dashboard_features where feature_key = 'shops.godam';
delete from public.feature_help where feature_key = 'shops.godam';
delete from public.role_feature_permissions where feature_key = 'shops.godam';
delete from public.features where key = 'shops.godam';

drop function if exists public.fn_shop_linked_godam_stock(uuid, uuid[]);
drop trigger if exists trg_shop_godams_guard on public.shop_godams;
drop function if exists public.fn_shop_godams_guard();
drop table if exists public.shop_godams;
