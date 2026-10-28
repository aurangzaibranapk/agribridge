-- 660 rollback: CMS write wapas staff_all_access. Phone wapas nahi (owner number reh sakta hai).
do $$
declare t text;
begin
  foreach t in array array[
    'blog_posts','testimonials','gallery_items','faqs','hero_slides',
    'website_settings','menu_items','static_pages','media_library','platform_settings'
  ]
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists cms_editor_write on public.%I', t);
    execute format(
      'create policy staff_all_access on public.%I for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff())',
      t
    );
  end loop;
end $$;

drop function if exists public.fn_is_cms_editor();
