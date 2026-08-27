-- Mobile-first registration: full_name and cnic move from "required at
-- signup" to "filled in later during Basic Information". Both become
-- nullable (unique constraint on cnic still holds — Postgres treats
-- multiple NULLs as distinct, so that's safe).
alter table farmers alter column full_name drop not null;
alter table farmers alter column cnic drop not null;

-- Farming Details section
alter table farmers
  add column if not exists land_size_acres numeric(10,2),
  add column if not exists crop_types text[] not null default '{}',
  add column if not exists has_livestock boolean not null default false,
  add column if not exists livestock_details text;

-- Documents Upload section (distinct from the old member_photo_url /
-- cnic_front_url / cnic_back_url columns added in migration 015, which
-- are left in place unused rather than dropped, to avoid touching data
-- from the previous iteration of this feature).
alter table farmers
  add column if not exists cnic_image_url text,
  add column if not exists land_ownership_proof_url text,
  add column if not exists crop_image_urls text[] not null default '{}',
  add column if not exists animal_image_urls text[] not null default '{}';

-- Notification preference toggle shown during profile completion.
alter table farmers
  add column if not exists whatsapp_notifications_enabled boolean not null default false;
