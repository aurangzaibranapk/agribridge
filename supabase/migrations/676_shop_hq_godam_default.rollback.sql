-- 676 wapas. Trigger hat ta hai. Jo link lag chuke hain wo rehte hain;
-- table 675 ka rollback unhen mitaata hai.

drop trigger if exists trg_shop_link_hq_godam on public.shops;
drop function if exists public.fn_shop_link_hq_godam();
drop function if exists public.fn_hq_godam_id(uuid);
