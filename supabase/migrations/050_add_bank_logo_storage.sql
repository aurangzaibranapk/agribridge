-- Add logo_url column to finance_accounts for storing bank logos from Supabase Storage
ALTER TABLE finance_accounts ADD COLUMN logo_url TEXT;

-- Create storage bucket for bank logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-logos', 'bank-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for bank-logos bucket
CREATE POLICY "Public read access for bank logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-logos');

CREATE POLICY "Authenticated users can upload bank logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bank-logos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Admin can delete bank logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'bank-logos'
  AND (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  )
);