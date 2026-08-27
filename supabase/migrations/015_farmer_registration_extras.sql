-- Extends the public Farmer Registration form: nickname, backup contact,
-- land/animal notes, and identity documents (member photo + CNIC front/back).
-- The staff-only fields shown in the internal "Member Management" mockup
-- (Milk Financing, Auto Khata Bank Cashout, KMS ID) are intentionally
-- included here as columns so Admin Panel can manage them later, but they
-- are NOT exposed on the public registration form — a farmer should never
-- be able to set these about themselves; staff set them after verification.

alter table farmers
  add column if not exists nickname text,
  add column if not exists backup_phone_number text,
  add column if not exists land_animal_details text,
  add column if not exists member_photo_url text,
  add column if not exists cnic_front_url text,
  add column if not exists cnic_back_url text,
  add column if not exists milk_financing_enabled boolean not null default false,
  add column if not exists auto_khata_bank_cashout boolean not null default false,
  add column if not exists kms_id text;

-- Storage bucket for identity documents uploaded during registration.
-- Uploads happen server-side via the service-role client inside the
-- registerFarmer server action (same trusted pattern already used for
-- the farmers table insert itself), so no public/anon insert policy is
-- needed — only a public-read policy so admin/staff and the farmer's
-- own portal can display the images back.
insert into storage.buckets (id, name, public)
values ('farmer-documents', 'farmer-documents', true)
on conflict (id) do nothing;

create policy "public read farmer-documents" on storage.objects for select
  using (bucket_id = 'farmer-documents');
