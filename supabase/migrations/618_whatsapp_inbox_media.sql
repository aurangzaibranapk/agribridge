-- 618: WhatsApp Inbox -- media (tasveer / voice) ka private bucket. ADDITIVE ONLY. NOT applied.
-- Path: <conversation_id>/<file>. Parhna sirf jo conversation dekh sake (614 rok);
-- likhna sirf service_role (webhook). Public URL nahi -- signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wa-media', 'wa-media', false, 16777216,
        array['image/jpeg','image/png','image/webp','audio/ogg','audio/mpeg','audio/mp4','audio/aac','audio/amr'])
on conflict (id) do nothing;

drop policy if exists wa_media_read on storage.objects;
create policy wa_media_read on storage.objects for select to authenticated
  using (bucket_id = 'wa-media'
         and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.fn_wa_inbox_can_see(((storage.foldername(name))[1])::uuid));
