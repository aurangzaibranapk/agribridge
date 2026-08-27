-- =====================================================================
-- AgriBridge — Migration 029b: Marketplace Payout Fix
-- =====================================================================
-- fn_create_payout_on_verification (Migration 002b) always inserted a
-- dealer_payouts row on verification - fine when a dealer fulfils the
-- order, but marketplace orders can have assigned_dealer_id = NULL
-- (Al Rana's own stock), which would violate dealer_payouts' NOT NULL
-- dealer_id. Skip the payout row entirely in that case - there's no
-- dealer to pay when Al Rana fulfils its own stock.

create or replace function fn_create_payout_on_verification() returns trigger as $$
begin
  if new.status = 'staff_verified' and old.status is distinct from 'staff_verified' then
    new.verified_at := now();
    if new.assigned_dealer_id is not null then
      insert into dealer_payouts (dealer_id, order_id, amount, status)
        values (new.assigned_dealer_id, new.id, new.dealer_payout_amount, 'pending');
    end if;
  end if;
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at := now();
  end if;
  return new;
end;
$$ language plpgsql;