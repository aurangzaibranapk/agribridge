-- 660: Website CMS likhai sirf Owner / Super Admin / Admin.
-- Public parhna waise hi rehta hai. Contact form ki public INSERT nahi chheri.
-- Phone owner ne tasdeeq kiya: 0312-6513294. Pata yahan nahi bhara jata.
-- ADDITIVE. Data cleanup (triple-quoted JSON) docs mein hai, yahan nahi.

create or replace function public.fn_is_cms_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in ('owner', 'super_admin', 'admin')
  );
$$;

revoke all on function public.fn_is_cms_editor() from public, anon;
grant execute on function public.fn_is_cms_editor() to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array[
    'blog_posts','testimonials','gallery_items','faqs','hero_slides',
    'website_settings','menu_items','static_pages','media_library','platform_settings'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('drop policy if exists staff_all_access on public.%I', t);
    execute format('drop policy if exists cms_editor_write on public.%I', t);
    execute format(
      'create policy cms_editor_write on public.%I for all using (public.fn_is_cms_editor()) with check (public.fn_is_cms_editor())',
      t
    );
  end loop;
end $$;

-- Owner-approved shop phone. Address placeholder rehta hai.
insert into public.website_settings (key, value)
values ('contact_phone', to_jsonb('+923126513294'::text))
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
