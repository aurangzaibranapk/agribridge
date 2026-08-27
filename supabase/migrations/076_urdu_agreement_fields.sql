-- =====================================================================
-- AgriBridge — Migration 076: Digital Urdu Rent Agreement + E-Signature
-- =====================================================================
-- Full legal agreement fields matching the user's real Urdu template,
-- plus a signing_token (public link) and signature image data (base64
-- PNG from a canvas signature pad, mouse or touch) for both parties.
-- The signed record stays permanently digital in the database - no
-- PDF conversion needed since browsers render Urdu/RTL natively.

alter table shop_rent_agreements add column if not exists security_deposit numeric(10,2) default 0;
alter table shop_rent_agreements add column if not exists annual_increase_percent numeric(5,2) default 0;
alter table shop_rent_agreements add column if not exists duration_years integer default 1;
alter table shop_rent_agreements add column if not exists renewal_years integer default 1;
alter table shop_rent_agreements add column if not exists bank_account_title text;
alter table shop_rent_agreements add column if not exists bank_name text;
alter table shop_rent_agreements add column if not exists bank_account_number text;
alter table shop_rent_agreements add column if not exists approved_use text default 'Office, Warehouse, Retail Outlet';
alter table shop_rent_agreements add column if not exists shop_size text;
alter table shop_rent_agreements add column if not exists shop_full_address text;
alter table shop_rent_agreements add column if not exists company_rep_name text;
alter table shop_rent_agreements add column if not exists company_rep_title text;
alter table shop_rent_agreements add column if not exists witness1_name text;
alter table shop_rent_agreements add column if not exists witness1_cnic text;
alter table shop_rent_agreements add column if not exists witness2_name text;
alter table shop_rent_agreements add column if not exists witness2_cnic text;

alter table shop_rent_agreements add column if not exists signing_token text unique;
alter table shop_rent_agreements add column if not exists landlord_signature_data text;
alter table shop_rent_agreements add column if not exists landlord_signed_at timestamptz;
alter table shop_rent_agreements add column if not exists company_signature_data text;
alter table shop_rent_agreements add column if not exists company_signed_at timestamptz;

-- Public (unauthenticated) read/sign access for the landlord signing
-- link - restricted to matching signing_token via the app logic, not
-- browsable listing (service-role client used for all token lookups).