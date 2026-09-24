-- Supplier bill par payment screenshot ka link store karne ke liye column
-- aur Supabase Storage mein bucket.

-- Column add karo purchases table mein
alter table public.purchases
  add column if not exists payment_proof_url text;

-- Storage bucket: payment-proofs (public read, authenticated write)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  true,
  5242880, -- 5 MB max
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- RLS policies for payment-proofs bucket
create policy "payment_proofs_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'payment-proofs');

create policy "payment_proofs_read"
  on storage.objects for select
  to public
  using (bucket_id = 'payment-proofs');
