-- Rollback 618. Bucket sirf khali ho to hatayein (files pehle storage API se).
drop policy if exists wa_media_read on storage.objects;
delete from storage.buckets where id = 'wa-media' and not exists (select 1 from storage.objects o where o.bucket_id = 'wa-media');
