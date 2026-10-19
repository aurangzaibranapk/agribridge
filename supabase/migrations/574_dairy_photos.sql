-- 574: Janwar ki tasveer -- private storage bucket, sirf apne folder tak.
-- Path: <farmer_id>/<animal_id>/<uuid>.webp (+ _thumb.webp). Delete nahi.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dairy-photos', 'dairy-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists dairy_photos_own_insert on storage.objects;
create policy dairy_photos_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dairy-photos' and split_part(name, '/', 1) = public.fn_dairy_my_farmer_id()::text);
drop policy if exists dairy_photos_own_select on storage.objects;
create policy dairy_photos_own_select on storage.objects for select to authenticated
  using (bucket_id = 'dairy-photos' and (split_part(name, '/', 1) = public.fn_dairy_my_farmer_id()::text or public.fn_is_staff(auth.uid())));
drop policy if exists dairy_photos_own_update on storage.objects;
create policy dairy_photos_own_update on storage.objects for update to authenticated
  using (bucket_id = 'dairy-photos' and split_part(name, '/', 1) = public.fn_dairy_my_farmer_id()::text)
  with check (bucket_id = 'dairy-photos' and split_part(name, '/', 1) = public.fn_dairy_my_farmer_id()::text);

alter table public.dairy_animals add column if not exists photo_thumb_path text;

-- Tasveer ka path sirf apne folder ka ho sakta hai.
create or replace function public.fn_dairy_photo_path_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.photo_path is not null and split_part(new.photo_path, '/', 1) <> new.farmer_id::text then
    raise exception 'Tasveer sirf apne folder ki';
  end if;
  if new.photo_thumb_path is not null and split_part(new.photo_thumb_path, '/', 1) <> new.farmer_id::text then
    raise exception 'Tasveer sirf apne folder ki';
  end if;
  return new;
end $$;
drop trigger if exists trg_dairy_photo_path_guard on public.dairy_animals;
create trigger trg_dairy_photo_path_guard before insert or update of photo_path, photo_thumb_path on public.dairy_animals
  for each row execute function public.fn_dairy_photo_path_guard();
