-- =====================================================================
-- AgriBridge — Migration 090: POS Payment Details (Card/Wallet/QR + Ref)
-- =====================================================================
-- Kept separate from the existing create_pos_sale() RPC (which only
-- accepts cash/khata split) so we don't risk breaking that function.
-- After a sale is created, the POS client records the DETAILED
-- payment method + transaction reference here for the receipt/audit.

create table if not exists pos_sale_payment_details (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null,
  payment_method text not null check (payment_method in ('cash','bank_transfer','card','jazzcash','easypaisa','qr','khata')),
  amount numeric(12,2) not null,
  transaction_reference text,
  bank_name text,
  created_at timestamptz not null default now()
);

alter table pos_sale_payment_details enable row level security;
create policy staff_manage_pos_payment_details on pos_sale_payment_details for all using (
  exists (select 1 from profiles where id = auth.uid() and is_active = true)
) with check (
  exists (select 1 from profiles where id = auth.uid() and is_active = true)
);