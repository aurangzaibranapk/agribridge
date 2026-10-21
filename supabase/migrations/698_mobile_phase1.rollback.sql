-- 698 rollback. App source wali hazri pehle hatani hogi warna constraint nahi baithega.

drop policy if exists mobile_inbox_read_own on public.mobile_sync_inbox;
drop table if exists public.mobile_sync_inbox;

drop index if exists milk_route_collections_client_uuid;
alter table public.milk_route_collections drop column if exists client_uuid;

alter table public.support_ticket_attachments drop constraint if exists support_ticket_attachments_mime_check;
alter table public.support_ticket_attachments add constraint support_ticket_attachments_mime_check
  check (mime in ('image/png', 'image/jpeg', 'image/webp', 'image/gif'));

update storage.buckets
   set allowed_mime_types = (
     select coalesce(array_agg(mime order by mime), '{}')
       from unnest(coalesce(allowed_mime_types, '{}'::text[])) as mime
      where mime not in ('audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/webm', 'audio/wav')
   )
 where id = 'support-evidence';

alter table public.support_tickets drop constraint if exists support_tickets_intake_source_check;
alter table public.support_tickets add constraint support_tickets_intake_source_check
  check (intake_source is null or intake_source in ('support', 'staff', 'call_center'));

alter table public.attendance_records drop constraint if exists attendance_records_source_check;
alter table public.attendance_records add constraint attendance_records_source_check
  check (source = ANY (ARRAY['web','pwa','whatsapp','biometric','correction','offline','leave']));

alter table public.milk_rate_settings
  drop column if exists fat_min,
  drop column if exists fat_max,
  drop column if exists lr_min,
  drop column if exists lr_max,
  drop column if exists snf_alert_low,
  drop column if exists snf_alert_high;

alter table public.staff_details drop constraint if exists staff_details_field_app_role_check;
alter table public.staff_details drop column if exists field_app_role;
