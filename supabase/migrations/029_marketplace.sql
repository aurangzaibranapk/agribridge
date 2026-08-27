-- =====================================================================
-- AgriBridge — Migration 029: Input Marketplace (Phase 3)
-- =====================================================================
-- Reuses the Bridge Order Engine (Migration 002b) rather than building
-- a parallel order system - a marketplace order is a bridge_order with
-- source = 'marketplace' instead of 'service_request'. The only new
-- concept: the buyer picks a PRODUCT + QUANTITY (not a dealer), and the
-- system finds whichever seller (a Dealer's stock, or Al Rana Traders'
-- own warehouse stock) has enough available at the lowest price -
-- assigned_dealer_id stays NULL when Al Rana's own stock is the winner,
-- meaning staff fulfil it directly (skip the dealer accept/dispatch
-- steps - same statuses, just interpreted without a dealer in the loop).

create type bridge_order_source as enum ('service_request', 'marketplace');
alter table bridge_orders add column source bridge_order_source not null default 'service_request';

-- Finds the cheapest available offer for a product+quantity, across
-- both dealer stock (dealer_inventory) and Al Rana's own warehouse
-- stock (inventory, scoped to the buyer's organization). Returns one
-- row: NULL dealer_id means "Al Rana's own stock", matching the
-- assigned_dealer_id convention used above.
create or replace function fn_find_marketplace_offer(
  p_product_id uuid,
  p_quantity numeric,
  p_organization_id uuid
) returns table (dealer_id uuid, unit_price numeric, available_quantity numeric) as $$
  select d.id as dealer_id, di.selling_price as unit_price, di.stock_quantity as available_quantity
  from dealer_inventory di
  join dealers d on d.id = di.dealer_id
  where di.product_id = p_product_id
    and d.organization_id = p_organization_id
    and d.is_active = true
    and d.verification_status = 'verified'
    and di.stock_quantity >= p_quantity

  union all

  select null as dealer_id, p.selling_price as unit_price, sum(i.quantity_on_hand) as available_quantity
  from inventory i
  join products p on p.id = i.product_id
  where i.product_id = p_product_id
    and p.organization_id = p_organization_id
  group by p.selling_price
  having sum(i.quantity_on_hand) >= p_quantity

  order by unit_price asc
  limit 1;
$$ language sql stable;