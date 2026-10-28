-- 686 rollback: filter hatao (675 wala function wapas), nayi tables hatao.
drop trigger if exists trg_shop_allowed_categories_log on public.shop_allowed_categories;
drop trigger if exists trg_shop_allowed_categories_guard on public.shop_allowed_categories;
create or replace function public.fn_shop_category_allowed(p_shop_id uuid, p_category_id uuid)
returns boolean language sql stable as $$ select true $$;
-- 675 ki body dobara chalayein: supabase/migrations/675_shop_godams.sql se fn_shop_linked_godam_stock.
drop table if exists public.shop_allowed_categories_log;
drop table if exists public.shop_allowed_categories;
drop function if exists public.fn_shop_allowed_categories_guard();
drop function if exists public.fn_shop_allowed_categories_log();
