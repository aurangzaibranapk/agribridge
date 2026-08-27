-- =====================================================================
-- AgriBridge — Migration 004: Logistics (tracking, delivery OTP, photo, GPS)
-- =====================================================================
-- Adds real courier-style delivery verification to the Bridge Order
-- Engine: a tracking number for farmer visibility, and an OTP the farmer
-- reads out to the dealer at handover — much stronger proof-of-delivery
-- than a farmer self-clicking "I received this", which is still kept as
-- a fallback for when the OTP flow can't be used.

alter table bridge_orders add column tracking_number text unique;
alter table bridge_orders add column delivery_otp text;
alter table bridge_orders add column delivery_photo_url text;
alter table bridge_orders add column delivery_latitude double precision;
alter table bridge_orders add column delivery_longitude double precision;
alter table bridge_orders add column otp_verified_at timestamptz;

-- Generates a tracking number and a 6-digit OTP the moment an order is
-- dispatched — this is when the farmer first needs to know the OTP, and
-- generating it any earlier would just be exposing it before it matters.
create or replace function fn_generate_dispatch_tracking() returns trigger as $$
begin
  if new.status = 'dealer_dispatched' and old.status is distinct from 'dealer_dispatched' then
    if new.tracking_number is null then
      new.tracking_number := 'TRK-' || to_char(now(), 'YYYY') || '-' || lpad(floor(random() * 1000000)::text, 6, '0');
    end if;
    if new.delivery_otp is null then
      new.delivery_otp := lpad(floor(random() * 1000000)::text, 6, '0');
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_generate_dispatch_tracking
  before update of status on bridge_orders
  for each row execute function fn_generate_dispatch_tracking();

-- Proof-of-delivery photos, uploaded by the dealer at handover.
insert into storage.buckets (id, name, public) values ('delivery-proof', 'delivery-proof', true) on conflict (id) do nothing;

create policy "authenticated uploads delivery-proof" on storage.objects for insert
  with check (bucket_id = 'delivery-proof' and auth.role() = 'authenticated');
create policy "public read delivery-proof" on storage.objects for select
  using (bucket_id = 'delivery-proof');
