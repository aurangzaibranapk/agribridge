-- 698: Mobile app phase 1. FILE ONLY — Live par mat chalana.
-- Pehle backup, phir Testing, phir Live. Owner ki manzoori ke baghair nahi.
-- Sab izafa hai. Koi purani qatarein nahi mit-ti.

-- MCA / MCO desk. Khali = purana behaviour (designation se faisla).
alter table public.staff_details
  add column if not exists field_app_role text;
alter table public.staff_details drop constraint if exists staff_details_field_app_role_check;
alter table public.staff_details add constraint staff_details_field_app_role_check
  check (field_app_role is null or field_app_role in ('mca', 'mco'));

-- Hadd settings se. Null = portal ki maujooda hadd. Sample adad nahi bhare.
alter table public.milk_rate_settings
  add column if not exists fat_min numeric,
  add column if not exists fat_max numeric,
  add column if not exists lr_min numeric,
  add column if not exists lr_max numeric,
  add column if not exists snf_alert_low numeric,
  add column if not exists snf_alert_high numeric;

-- App ki hazri. Live pehle se web, pwa, whatsapp, biometric, correction,
-- offline, leave rakhta hai (correction ki qatarein maujood hain). Sirf 'app' izafa.
alter table public.attendance_records drop constraint if exists attendance_records_source_check;
alter table public.attendance_records add constraint attendance_records_source_check
  check (source is null or source in ('web','pwa','whatsapp','biometric','correction','offline','leave','app'));

-- Tester ki report. Live: null, support, staff, call_center. Sirf mobile_app izafa.
alter table public.support_tickets drop constraint if exists support_tickets_intake_source_check;
alter table public.support_tickets add constraint support_tickets_intake_source_check
  check (intake_source is null or intake_source in ('support', 'staff', 'call_center', 'mobile_app'));

-- Live mime: image/png, jpeg, webp, gif. Awaz in ke sath judti hai, koi purani qism nahi hat-ti.
alter table public.support_ticket_attachments drop constraint if exists support_ticket_attachments_mime_check;
alter table public.support_ticket_attachments add constraint support_ticket_attachments_mime_check
  check (mime in (
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/webm', 'audio/wav'
  ));

update storage.buckets
   set allowed_mime_types = (
     select coalesce(array_agg(distinct mime), '{}')
       from unnest(
         coalesce(allowed_mime_types, '{}'::text[])
         || array['audio/mp4','audio/mpeg','audio/aac','audio/webm','audio/wav']
       ) as mime
   )
 where id = 'support-evidence';

-- Chiller drop ki dobara koshish.
alter table public.milk_route_collections
  add column if not exists client_uuid uuid;
create unique index if not exists milk_route_collections_client_uuid
  on public.milk_route_collections (client_uuid) where client_uuid is not null;

-- Phone badalne par offline queue. Sirf apni qatarein. Applied service role likhta hai.
create table if not exists public.mobile_sync_inbox (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_uuid uuid not null,
  kind text not null,
  payload jsonb not null,
  status text not null default 'stored' check (status in ('stored', 'applied', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (profile_id, client_uuid)
);

create index if not exists mobile_sync_inbox_profile_status
  on public.mobile_sync_inbox (profile_id, status, created_at);

alter table public.mobile_sync_inbox enable row level security;
revoke all on public.mobile_sync_inbox from public, anon, authenticated;
grant select on public.mobile_sync_inbox to authenticated;

drop policy if exists mobile_inbox_read_own on public.mobile_sync_inbox;
create policy mobile_inbox_read_own on public.mobile_sync_inbox
  for select to authenticated
  using (profile_id = (select auth.uid()));

comment on table public.mobile_sync_inbox is
  'Mobile offline queue ka server udhaar. Naya phone wahi pending uthata hai. Applied business tables mein hai.';
